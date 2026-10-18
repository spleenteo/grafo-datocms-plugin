import { drag } from 'd3-drag';
import type { D3DragEvent } from 'd3-drag';
import {
  forceCollide,
  forceLink,
  forceManyBody,
  forceSimulation,
  forceX,
  forceY,
} from 'd3-force';
import { select } from 'd3-selection';
import { zoom, zoomIdentity } from 'd3-zoom';
import type { D3ZoomEvent } from 'd3-zoom';
import styles from './graph.module.css';
import type { prepareSimulation, SimLink, SimNode } from './prepareSimulation';

export interface RenderGraphOptions {
  modelName: (model: number) => string;
  onOpen: (node: SimNode) => void;
}

const PRETICK_MAX_NODES = 1000;
const PRETICKS = 300;
const FIT_PADDING = 40;
const FIT_MAX_SCALE = 2;

let markerSeq = 0;

function nodeColor(colorIndex: number[], model: number): string {
  const ci = colorIndex[model] ?? 0;
  const hue = Math.round((ci * 137.508 + 12) % 360);
  const l = ci % 2 === 0 ? 'var(--node-l0)' : 'var(--node-l1)';
  return `hsl(${hue} var(--node-s) ${l})`;
}

export function renderGraph(
  svgEl: SVGSVGElement,
  data: ReturnType<typeof prepareSimulation>,
  options: RenderGraphOptions,
): { destroy(): void } {
  const { modelName, onOpen } = options;

  // Own copies: d3 writes x/y/vx/vy on nodes and swaps link ends for objects,
  // so a second mount (StrictMode) or re-render never sees mutated input.
  const nodes: SimNode[] = data.nodes.map((n) => ({
    id: n.id,
    title: n.title,
    itemTypeId: n.itemTypeId,
    model: n.model,
    status: n.status,
    degree: n.degree,
    r: n.r,
  }));
  const indexOf = new Map<SimNode, number>();
  data.nodes.forEach((n, i) => indexOf.set(n, i));
  const endIndex = (end: SimLink['source']): number =>
    typeof end === 'object' ? (indexOf.get(end as SimNode) ?? -1) : Number(end);
  const links: SimLink[] = data.links.map((l) => ({
    source: endIndex(l.source),
    target: endIndex(l.target),
    field: l.field,
  }));

  const svg = select(svgEl);
  svg.selectAll('*').remove();
  svg.classed(styles.root, true);

  const markerId = `cg-arrow-${++markerSeq}`;
  const marker = svg
    .append('defs')
    .append('marker')
    .attr('id', markerId)
    .attr('class', styles.arrow)
    .attr('viewBox', '0 0 10 10')
    .attr('refX', 9)
    .attr('refY', 5)
    .attr('markerWidth', 6)
    .attr('markerHeight', 6)
    .attr('orient', 'auto');
  marker.append('path').attr('d', 'M0 0 L10 5 L0 10 z');

  const viewport = svg.append('g');
  const linkLayer = viewport.append('g');
  const nodeLayer = viewport.append('g');

  const linkSel = linkLayer
    .selectAll<SVGLineElement, SimLink>('line')
    .data(links)
    .join('line')
    .attr('class', styles.link)
    .attr('marker-end', `url(#${markerId})`);

  const nodeSel = nodeLayer
    .selectAll<SVGGElement, SimNode>('g')
    .data(nodes)
    .join('g')
    .attr('class', styles.node)
    .attr('data-status', (d) => d.status)
    .each(function (d) {
      this.style.setProperty('--c', nodeColor(data.colorIndex, d.model));
    });
  nodeSel.append('title').text((d) => `${d.title} · ${modelName(d.model)}`);
  nodeSel
    .filter((d) => d.status === 'updated')
    .append('circle')
    .attr('class', styles.ring)
    .attr('r', (d) => d.r + 3.5);
  nodeSel
    .append('circle')
    .attr('class', styles.dot)
    .attr('r', (d) => d.r);

  function draw() {
    linkSel.each(function (d) {
      const s = d.source;
      const t = d.target;
      if (typeof s !== 'object' || typeof t !== 'object') return;
      const sx = s.x ?? 0;
      const sy = s.y ?? 0;
      const tx = t.x ?? 0;
      const ty = t.y ?? 0;
      const dx = tx - sx;
      const dy = ty - sy;
      const len = Math.sqrt(dx * dx + dy * dy) || 1;
      const startOff = s.r + 1;
      const endOff = t.r + (t.status === 'updated' ? 5 : 3);
      this.setAttribute('x1', String(sx + (dx / len) * startOff));
      this.setAttribute('y1', String(sy + (dy / len) * startOff));
      this.setAttribute('x2', String(tx - (dx / len) * endOff));
      this.setAttribute('y2', String(ty - (dy / len) * endOff));
    });
    nodeSel.attr('transform', (d) => `translate(${d.x ?? 0},${d.y ?? 0})`);
  }

  const zoomBehavior = zoom<SVGSVGElement, unknown>()
    .scaleExtent([0.1, 6])
    .on('zoom', (event: D3ZoomEvent<SVGSVGElement, unknown>) => {
      viewport.attr('transform', event.transform.toString());
    });
  svg.call(zoomBehavior).on('dblclick.zoom', null);
  // Reset any transform a previous mount left in the element's zoom state.
  svg.call(zoomBehavior.transform, zoomIdentity);

  function fit() {
    const w = svgEl.clientWidth;
    const h = svgEl.clientHeight;
    if (!w || !h || nodes.length === 0) return;
    let x0 = Infinity;
    let y0 = Infinity;
    let x1 = -Infinity;
    let y1 = -Infinity;
    for (const n of nodes) {
      const x = n.x ?? 0;
      const y = n.y ?? 0;
      x0 = Math.min(x0, x - n.r);
      x1 = Math.max(x1, x + n.r);
      y0 = Math.min(y0, y - n.r);
      y1 = Math.max(y1, y + n.r);
    }
    const bw = Math.max(1, x1 - x0);
    const bh = Math.max(1, y1 - y0);
    const availW = Math.max(1, w - 2 * FIT_PADDING);
    const availH = Math.max(1, h - 2 * FIT_PADDING);
    const k = Math.max(0.1, Math.min(FIT_MAX_SCALE, availW / bw, availH / bh));
    const tx = w / 2 - (k * (x0 + x1)) / 2;
    const ty = h / 2 - (k * (y0 + y1)) / 2;
    svg.call(zoomBehavior.transform, zoomIdentity.translate(tx, ty).scale(k));
  }

  const simulation = forceSimulation<SimNode, SimLink>(nodes)
    .force('link', forceLink<SimNode, SimLink>(links).distance(40).strength(0.55))
    .force(
      'charge',
      forceManyBody<SimNode>().strength((d) => -(70 + d.r * 9)),
    )
    .force('x', forceX<SimNode>(0).strength(0.05))
    .force('y', forceY<SimNode>(0).strength(0.05))
    .force(
      'collide',
      forceCollide<SimNode>((d) => d.r + 4),
    )
    .stop();

  let fitOnEnd = false;
  simulation.on('tick', draw).on('end', () => {
    if (!fitOnEnd) return;
    fitOnEnd = false;
    fit();
  });

  // Drag: reheat on the first `drag` event (not `start`) so a plain click
  // leaves the layout alone. d3-drag suppresses the click after a real drag.
  let dragging = false;
  const dragBehavior = drag<SVGGElement, SimNode>()
    .on('start', (_event: D3DragEvent<SVGGElement, SimNode, SimNode>, d) => {
      dragging = false;
      d.fx = d.x;
      d.fy = d.y;
    })
    .on('drag', (event: D3DragEvent<SVGGElement, SimNode, SimNode>, d) => {
      if (!dragging) {
        dragging = true;
        simulation.alphaTarget(0.25).restart();
      }
      d.fx = event.x;
      d.fy = event.y;
    })
    .on('end', (_event: D3DragEvent<SVGGElement, SimNode, SimNode>, d) => {
      if (dragging) simulation.alphaTarget(0);
      dragging = false;
      d.fx = null;
      d.fy = null;
    });
  nodeSel.call(dragBehavior);
  nodeSel.on('click', (event: MouseEvent, d) => {
    event.stopPropagation();
    onOpen(d);
  });

  if (nodes.length > 0) {
    if (nodes.length <= PRETICK_MAX_NODES) {
      simulation.alpha(1);
      simulation.tick(PRETICKS);
      draw();
      fit();
    } else {
      fitOnEnd = true;
      simulation.alpha(1).restart();
    }
  }

  return {
    destroy() {
      simulation.stop();
      simulation.on('tick', null).on('end', null);
      nodeSel.on('.drag', null).on('click', null);
      svg.on('.zoom', null);
      // `interrupt` is patched onto selections by d3-transition, which d3-zoom
      // imports; no transitions are started here, this is belt and braces.
      (svg as unknown as { interrupt?: () => void }).interrupt?.();
      svg.selectAll('*').remove();
      svg.classed(styles.root, false);
    },
  };
}
