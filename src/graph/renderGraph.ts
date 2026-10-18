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
import type { EnterElement, Selection } from 'd3-selection';
import { zoom, zoomIdentity } from 'd3-zoom';
import type { D3ZoomEvent } from 'd3-zoom';
import { sameVisibleSet } from '../data/filterGraph';
import type { VisibleSet } from '../data/filterGraph';
import styles from './graph.module.css';
import { modelColor } from './modelColor';
import type { prepareSimulation, SimLink, SimNode } from './prepareSimulation';

export interface RenderGraphOptions {
  modelName: (model: number) => string;
  onOpen: (node: SimNode) => void;
}

export interface RenderGraphHandle {
  /** Applies a new visible set on the running simulation; a no-op when it equals the last applied one. */
  update(visible: VisibleSet): void;
  destroy(): void;
}

type RenderLink = SimLink;
type NodeSelection = Selection<SVGGElement, SimNode, SVGGElement, unknown>;
type LinkSelection = Selection<SVGLineElement, RenderLink, SVGGElement, unknown>;

const PRETICK_MAX_NODES = 1000;
const PRETICKS = 300;
const FIT_PADDING = 40;
const FIT_MAX_SCALE = 2;
const UPDATE_ALPHA = 0.55;

let markerSeq = 0;

export function renderGraph(
  svgEl: SVGSVGElement,
  data: ReturnType<typeof prepareSimulation>,
  options: RenderGraphOptions,
): RenderGraphHandle {
  const { modelName, onOpen } = options;

  // Own copies: d3 writes x/y/vx/vy on nodes and swaps link ends for objects,
  // so a second mount (StrictMode) or re-render never sees mutated input.
  const nodeById = new Map<string, SimNode>();
  for (const n of data.nodes) {
    nodeById.set(n.id, {
      id: n.id,
      title: n.title,
      itemTypeId: n.itemTypeId,
      model: n.model,
      status: n.status,
      degree: n.degree,
      r: n.r,
    });
  }
  const allNodes: SimNode[] = [...nodeById.values()];
  // Link ends are node ids here; forceLink swaps them for the node objects
  // above, which are stable for the life of the mount, so a link that leaves
  // and comes back keeps pointing at the same objects.
  const endId = (end: SimLink['source']): string =>
    typeof end === 'object' ? end.id : String(end);
  const linkByEdge = new Map<number, RenderLink>();
  for (const l of data.links) {
    linkByEdge.set(l.edge, {
      source: endId(l.source),
      target: endId(l.target),
      field: l.field,
      edge: l.edge,
    });
  }
  const allLinks: RenderLink[] = [...linkByEdge.values()];

  // Mutable render state: reassigned on every update, read by draw/fit.
  let visibleNodes: SimNode[] = allNodes;
  let lastApplied: VisibleSet = {
    coreIds: new Set(allNodes.map((n) => n.id)),
    contextIds: new Set(),
    edgeIndexes: allLinks.map((l) => l.edge),
  };

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

  const markerUrl = `url(#${markerId})`;

  function enterLinks(enter: Selection<EnterElement, RenderLink, SVGGElement, unknown>) {
    return enter.append('line').attr('class', styles.link).attr('marker-end', markerUrl);
  }

  // Used by mount and update. `dragBehavior` is declared further down; it is
  // only read when join() first runs, after its declaration.
  function enterNodes(enter: Selection<EnterElement, SimNode, SVGGElement, unknown>) {
    const g = enter
      .append('g')
      .attr('class', styles.node)
      .attr('data-status', (d) => d.status)
      .each(function (d) {
        this.style.setProperty('--c', modelColor(data.colorIndex[d.model] ?? 0));
      });
    g.append('title').text((d) => `${d.title} · ${modelName(d.model)}`);
    g.filter((d) => d.status === 'updated')
      .append('circle')
      .attr('class', styles.ring)
      .attr('r', (d) => d.r + 3.5);
    g.append('circle')
      .attr('class', styles.dot)
      .attr('r', (d) => d.r);
    g.call(dragBehavior);
    g.on('click', (event: MouseEvent, d) => {
      event.stopPropagation();
      onOpen(d);
    });
    return g;
  }

  let linkSel: LinkSelection = linkLayer.selectAll<SVGLineElement, RenderLink>('line');
  let nodeSel: NodeSelection = nodeLayer.selectAll<SVGGElement, SimNode>('g');

  function join(nodesToShow: SimNode[], linksToShow: RenderLink[], contextIds: Set<string>) {
    linkSel = linkLayer
      .selectAll<SVGLineElement, RenderLink>('line')
      .data(linksToShow, (d) => d.edge)
      .join(enterLinks, (u) => u, (x) => x.remove());
    nodeSel = nodeLayer
      .selectAll<SVGGElement, SimNode>('g')
      .data(nodesToShow, (d) => d.id)
      .join(enterNodes, (u) => u, (x) => x.remove());
    nodeSel.classed(styles.ctx, (d) => contextIds.has(d.id));
  }

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
    if (!w || !h || visibleNodes.length === 0) return;
    let x0 = Infinity;
    let y0 = Infinity;
    let x1 = -Infinity;
    let y1 = -Infinity;
    for (const n of visibleNodes) {
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

  const linkForce = forceLink<SimNode, RenderLink>(allLinks)
    .id((d) => d.id)
    .distance(40)
    .strength(0.55);
  const simulation = forceSimulation<SimNode, RenderLink>(allNodes)
    .force('link', linkForce)
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

  // Drag (POC pattern on `event.active`): pin on `start`, reheat on the first
  // `drag` event of a gesture (not on `start`) so a plain click leaves the
  // layout alone, release on `end`. d3-drag counts the current gesture in
  // `active` during `drag` (but not during `start`/`end`), so "no other
  // gesture" is `active === 1` there. d3-drag suppresses the click after a
  // real drag.
  let destroyed = false;
  const pendingReheat = new Set<SimNode>();
  const dragBehavior = drag<SVGGElement, SimNode>()
    .on('start', (_event: D3DragEvent<SVGGElement, SimNode, SimNode>, d) => {
      if (destroyed) return;
      pendingReheat.add(d);
      d.fx = d.x;
      d.fy = d.y;
    })
    .on('drag', (event: D3DragEvent<SVGGElement, SimNode, SimNode>, d) => {
      if (destroyed) return;
      if (pendingReheat.delete(d) && event.active === 1) {
        simulation.alphaTarget(0.25).restart();
      }
      d.fx = event.x;
      d.fy = event.y;
    })
    .on('end', (event: D3DragEvent<SVGGElement, SimNode, SimNode>, d) => {
      if (destroyed) return;
      pendingReheat.delete(d);
      if (!event.active) simulation.alphaTarget(0);
      d.fx = null;
      d.fy = null;
    });

  join(allNodes, allLinks, lastApplied.contextIds);

  if (allNodes.length > 0) {
    if (allNodes.length <= PRETICK_MAX_NODES) {
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
    update(visible: VisibleSet) {
      if (destroyed || sameVisibleSet(visible, lastApplied)) return;
      lastApplied = visible;

      const isVisible = (id: string) => visible.coreIds.has(id) || visible.contextIds.has(id);
      // Graph order, not set order, so the DOM order is stable across updates.
      visibleNodes = allNodes.filter((n) => isVisible(n.id));
      const visibleLinks: RenderLink[] = [];
      for (const edge of visible.edgeIndexes) {
        const l = linkByEdge.get(edge);
        // Self-links have no renderer link; a link with an end outside the
        // visible nodes would make forceLink throw, so it is skipped too.
        if (!l || !isVisible(endId(l.source)) || !isVisible(endId(l.target))) continue;
        visibleLinks.push(l);
      }

      // Order matters: nodes first (re-indexes them, keeps x/y/vx/vy), then
      // links (forceLink resolves ends against the current nodes).
      simulation.nodes(visibleNodes);
      linkForce.links(visibleLinks);
      join(visibleNodes, visibleLinks, visible.contextIds);

      if (visibleNodes.length === 0) {
        fitOnEnd = false;
        simulation.stop();
        return;
      }
      draw();
      fitOnEnd = true;
      simulation.alpha(UPDATE_ALPHA).restart();
    },
    destroy() {
      destroyed = true;
      pendingReheat.clear();
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
