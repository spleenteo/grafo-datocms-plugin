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
import { zoom, zoomIdentity, zoomTransform } from 'd3-zoom';
import type { D3ZoomEvent } from 'd3-zoom';
import { sameVisibleSet } from '../data/filterGraph';
import type { VisibleSet } from '../data/filterGraph';
import styles from './graph.module.css';
import { modelColor } from './modelColor';
import type { prepareSimulation, SimLink, SimNode } from './prepareSimulation';

export type LabelMode = 'smart' | 'all' | 'focus';

export interface Point {
  x: number;
  y: number;
}

export interface ViewTransform {
  x: number;
  y: number;
  k: number;
}

export interface ViewState {
  transform: ViewTransform;
  userMoved: boolean;
}

export interface RenderGraphOptions {
  modelName: (model: number) => string;
  /** Node click or Enter/Space → its id; background click → null. The renderer does not change its own selection. */
  onSelect: (id: string | null) => void;
  /** Initial view state, applied at mount without reheating. */
  labelMode?: LabelMode;
  distance?: number;
  matchIds?: ReadonlySet<string>;
  /** Seeded mount (refresh): with positions the mount skips the pre-tick and the initial fit and settles at a low alpha. */
  initialPositions?: ReadonlyMap<string, Point>;
  initialTransform?: ViewTransform;
  initialUserMoved?: boolean;
}

export interface RenderGraphHandle {
  /** Applies a new visible set on the running simulation; a no-op when it equals the last applied one. */
  update(visible: VisibleSet): void;
  /** Marks a node as selected (halo, focus when nothing is hovered); an id outside the visible set counts as null. */
  setSelection(id: string | null): void;
  /** Centres a visible node at scale max(current, 1.2), no transition; a no-op for an id not visible. */
  focusOn(id: string): void;
  /** No-op when the mode does not change. Never reheats. */
  setLabelMode(mode: LabelMode): void;
  /** Search matches: labelled, and the rest dimmed when nothing has focus. An empty set clears. No-op when the content is unchanged. */
  setQuery(matchIds: ReadonlySet<string>): void;
  /** +/− buttons: an explicit user zoom, so it sets `userMoved`. */
  zoomBy(factor: number): void;
  /** Fits the visible nodes and resets `userMoved`. */
  fit(): void;
  /** Random restart of the layout, then fit; resets `userMoved`. */
  relayout(): void;
  /** Node distance multiplier; reheats at alpha 0.9. No-op when the value does not change. */
  setDistance(d: number): void;
  /** x/y of every node known to this mount, visible or not. */
  positions(): Map<string, Point>;
  viewState(): ViewState;
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
const FOCUS_MIN_SCALE = 1.2;
const LABEL_MAX = 30;
const PILL_PAD_X = 6;
const PILL_PAD_Y = 3;
const PILL_RADIUS = 4;
const DISTANCE_ALPHA = 0.9;
const RELAYOUT_SPREAD = 30;
const SMART_MIN_DEGREE = 10;
const SMART_MIN_SCALE = 1.8;
const SMART_MAX_NODES = 45;

function sameIdSet(a: ReadonlySet<string>, b: ReadonlySet<string>): boolean {
  if (a.size !== b.size) return false;
  for (const id of a) if (!b.has(id)) return false;
  return true;
}

function labelText(title: string): string {
  const chars = Array.from(title);
  return chars.length > LABEL_MAX ? `${chars.slice(0, LABEL_MAX - 1).join('')}…` : title;
}

let markerSeq = 0;

export function renderGraph(
  svgEl: SVGSVGElement,
  data: ReturnType<typeof prepareSimulation>,
  options: RenderGraphOptions,
): RenderGraphHandle {
  const { modelName, onSelect, initialPositions, initialTransform } = options;

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

  // Seeded nodes keep their old place; a node new to this mount starts next
  // to a seeded neighbour (or where d3 would put it when it has none). Runs
  // before the simulation initialises the nodes.
  if (initialPositions) seedPositions(initialPositions);
  function seedPositions(seed: ReadonlyMap<string, Point>) {
    for (const n of allNodes) {
      const p = seed.get(n.id);
      if (p) {
        n.x = p.x;
        n.y = p.y;
      }
    }
    for (const l of data.links) {
      const s = nodeById.get(endId(l.source));
      const t = nodeById.get(endId(l.target));
      if (!s || !t) continue;
      const [seeded, fresh] = s.x !== undefined ? [s, t] : [t, s];
      if (seeded.x === undefined || seeded.y === undefined || fresh.x !== undefined) continue;
      fresh.x = seeded.x + (Math.random() - 0.5) * 20;
      fresh.y = seeded.y + (Math.random() - 0.5) * 20;
    }
  }

  // Mutable render state: reassigned on every update, read by draw/fit.
  let visibleNodes: SimNode[] = allNodes;
  let visibleLinks: RenderLink[] = allLinks;
  let visibleIds = new Set(allNodes.map((n) => n.id));
  let selectedId: string | null = null;
  let hoveredId: string | null = null;
  let labelMode: LabelMode = options.labelMode ?? 'smart';
  let distance = options.distance ?? 1;
  let matchIds: ReadonlySet<string> = new Set(options.matchIds ?? []);
  // Set by user wheel/drag on the canvas and by zoomBy; never by fit, focusOn
  // or other programmatic transforms. When set, settles don't fit on `end`.
  let userMoved = options.initialUserMoved ?? false;
  let scale = 1;
  // Focus + neighbours from the last paint(); read by the labels-only pass.
  let focusSet = new Set<string>();
  // Last smart threshold on zoom, so a zoom only repaints labels when crossing it.
  let wasSmartScale = false;
  let destroyed = false;
  let lastApplied: VisibleSet = {
    coreIds: new Set(allNodes.map((n) => n.id)),
    contextIds: new Set(),
    edgeIndexes: allLinks.map((l) => l.edge),
  };

  const svg = select(svgEl);
  svg.selectAll('*').remove();
  svg.classed(styles.root, true);
  applyLabelModeClass();

  function applyLabelModeClass() {
    svg.classed(styles.labelsAll, labelMode === 'all').classed(styles.labelsFocus, labelMode === 'focus');
  }

  const markerPrefix = `cg-${++markerSeq}`;
  const defs = svg.append('defs');
  function appendMarker(id: string, className: string) {
    defs
      .append('marker')
      .attr('id', id)
      .attr('class', className)
      .attr('viewBox', '0 0 10 10')
      .attr('refX', 9)
      .attr('refY', 5)
      .attr('markerWidth', 6)
      .attr('markerHeight', 6)
      .attr('orient', 'auto')
      .append('path')
      .attr('d', 'M0 0 L10 5 L0 10 z');
  }
  appendMarker(`${markerPrefix}-ar`, styles.arrow);
  appendMarker(`${markerPrefix}-ar-hi`, styles.arrowHi);

  const viewport = svg.append('g');
  const linkLayer = viewport.append('g');
  const nodeLayer = viewport.append('g');

  const markerUrl = `url(#${markerPrefix}-ar)`;
  const markerHiUrl = `url(#${markerPrefix}-ar-hi)`;

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
      .attr('tabindex', 0)
      .attr('role', 'button')
      .attr('aria-label', (d) => `${d.title}, ${modelName(d.model)}`)
      .each(function (d) {
        this.style.setProperty('--c', modelColor(data.colorIndex[d.model] ?? 0));
      });
    g.append('title').text((d) => `${d.title} · ${modelName(d.model)}`);
    g.append('circle')
      .attr('class', styles.halo)
      .attr('r', (d) => d.r + 7);
    g.filter((d) => d.status === 'updated')
      .append('circle')
      .attr('class', styles.ring)
      .attr('r', (d) => d.r + 3.5);
    g.append('circle')
      .attr('class', styles.dot)
      .attr('r', (d) => d.r);
    g.append('text')
      .attr('class', styles.label)
      .attr('x', (d) => d.r + 5)
      .attr('y', 4)
      .text((d) => labelText(d.title));
    g.call(dragBehavior);
    g.on('click', (event: MouseEvent, d) => {
      event.stopPropagation();
      onSelect(d.id);
    })
      .on('keydown', (event: KeyboardEvent, d) => {
        if (event.key !== 'Enter' && event.key !== ' ') return;
        event.preventDefault();
        onSelect(d.id);
      })
      .on('mouseenter', (_event: MouseEvent, d) => {
        hoveredId = d.id;
        paint();
      })
      .on('mouseleave', (_event: MouseEvent, d) => {
        if (hoveredId !== d.id) return;
        hoveredId = null;
        paint();
      })
      .on('focus', (_event: FocusEvent, d) => {
        hoveredId = d.id;
        paint();
      })
      .on('blur', (_event: FocusEvent, d) => {
        if (hoveredId !== d.id) return;
        hoveredId = null;
        paint();
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

  // Focus = hovered node, else selected node (POC `paint()`). Neighbours are
  // the nodes at the other end of a visible link of the focus node.
  function paint() {
    if (destroyed) return;
    const sel = selectedId !== null && visibleIds.has(selectedId) ? selectedId : null;
    const hov = hoveredId !== null && visibleIds.has(hoveredId) ? hoveredId : null;
    const focus = hov ?? sel;
    const neighbours = new Set<string>();
    if (focus !== null) {
      neighbours.add(focus);
      for (const l of visibleLinks) {
        const s = endId(l.source);
        const t = endId(l.target);
        if (s === focus) neighbours.add(t);
        if (t === focus) neighbours.add(s);
      }
    }
    const hasQuery = matchIds.size > 0;
    nodeSel
      .classed(styles.selected, (d) => d.id === sel)
      .classed(styles.focused, (d) => d.id === focus)
      .classed(styles.dim, (d) =>
        focus !== null ? !neighbours.has(d.id) : hasQuery && !matchIds.has(d.id),
      );
    focusSet = neighbours;
    paintLabels();
    linkSel.each(function (d) {
      const isHi = focus !== null && (endId(d.source) === focus || endId(d.target) === focus);
      select(this)
        .classed(styles.hi, isHi)
        .classed(styles.dim, focus !== null && !isHi)
        .attr('marker-end', isHi ? markerHiUrl : markerUrl);
    });

    nodeLayer.selectAll(`.${styles.labelPill}`).remove();
    if (focus === null) return;
    nodeSel
      .filter((d) => d.id === focus)
      .each(function () {
        // Moving a focused element in the DOM drops keyboard focus.
        if (this !== document.activeElement) select(this).raise();
        const text = this.querySelector('text');
        if (!text) return;
        const box = text.getBBox();
        select(this)
          .insert('rect', 'text')
          .attr('class', styles.labelPill)
          .attr('x', box.x - PILL_PAD_X)
          .attr('y', box.y - PILL_PAD_Y)
          .attr('width', box.width + 2 * PILL_PAD_X)
          .attr('height', box.height + 2 * PILL_PAD_Y)
          .attr('rx', PILL_RADIUS);
      });
  }

  // Labels-only pass (POC `paintLabels`): focus + neighbours and matches
  // always; "All" is a root class; "Smart" adds hubs, or everything when zoomed
  // in or the graph is small. No link or pill work here.
  function paintLabels() {
    if (destroyed) return;
    const isSmart = labelMode === 'smart';
    wasSmartScale = scale >= SMART_MIN_SCALE;
    const isSmartAll = isSmart && (wasSmartScale || visibleNodes.length <= SMART_MAX_NODES);
    nodeSel.classed(
      styles.show,
      (d) =>
        focusSet.has(d.id) ||
        matchIds.has(d.id) ||
        (isSmart && (isSmartAll || d.degree >= SMART_MIN_DEGREE)),
    );
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
      scale = event.transform.k;
      if (event.sourceEvent) userMoved = true;
      if (labelMode === 'smart' && (scale >= SMART_MIN_SCALE) !== wasSmartScale) paintLabels();
    });
  svg.call(zoomBehavior).on('dblclick.zoom', null);
  // d3-zoom swallows the click that ends a pan, so this only fires on a plain
  // background click; node clicks stop propagation.
  svg.on('click', () => {
    if (!destroyed) onSelect(null);
  });
  // Reset any transform a previous mount left in the element's zoom state,
  // or restore the one a refresh carried over.
  svg.call(
    zoomBehavior.transform,
    initialTransform
      ? zoomIdentity.translate(initialTransform.x, initialTransform.y).scale(initialTransform.k)
      : zoomIdentity,
  );

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
    .strength(0.55);
  const chargeForce = forceManyBody<SimNode>();
  const xForce = forceX<SimNode>(0);
  const yForce = forceY<SimNode>(0);
  const collideForce = forceCollide<SimNode>();
  const simulation = forceSimulation<SimNode, RenderLink>(allNodes)
    .force('link', linkForce)
    .force('charge', chargeForce)
    .force('x', xForce)
    .force('y', yForce)
    .force('collide', collideForce)
    .stop();

  // Node distance D (POC `applyForces`): one multiplier for link length,
  // repulsion, centring and collision padding.
  function applyForces() {
    const D = distance;
    linkForce.distance(40 * D);
    chargeForce.strength((d) => -(70 + d.r * 9) * D);
    xForce.strength(0.05 / Math.max(D, 0.6));
    yForce.strength(0.05 / Math.max(D, 0.6));
    collideForce.radius((d) => d.r + 2 + 2 * D);
  }
  applyForces();

  // 'unlessMoved': settles started by update/distance; 'always': animated relayout.
  let fitOnEnd: 'none' | 'unlessMoved' | 'always' = 'none';
  simulation.on('tick', draw).on('end', () => {
    const mode = fitOnEnd;
    fitOnEnd = 'none';
    if (mode === 'always' || (mode === 'unlessMoved' && !userMoved)) fit();
  });

  // Drag (POC pattern on `event.active`): pin on `start`, reheat on the first
  // `drag` event of a gesture (not on `start`) so a plain click leaves the
  // layout alone, release on `end`. d3-drag counts the current gesture in
  // `active` during `drag` (but not during `start`/`end`), so "no other
  // gesture" is `active === 1` there. d3-drag suppresses the click after a
  // real drag.
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
  paint();

  if (allNodes.length > 0) {
    if (initialPositions) {
      simulation.alpha(UPDATE_ALPHA).restart();
    } else if (allNodes.length <= PRETICK_MAX_NODES) {
      simulation.alpha(1);
      simulation.tick(PRETICKS);
      draw();
      fit();
    } else {
      fitOnEnd = 'unlessMoved';
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
      visibleIds = new Set(visibleNodes.map((n) => n.id));
      visibleLinks = [];
      for (const edge of visible.edgeIndexes) {
        const l = linkByEdge.get(edge);
        // Self-links have no renderer link. A link with a hidden end is
        // skipped too: its ends are already node objects so forceLink would
        // not throw, but it would pull on a node outside the simulation.
        if (!l || !isVisible(endId(l.source)) || !isVisible(endId(l.target))) continue;
        visibleLinks.push(l);
      }

      // Order matters: nodes first (re-indexes them, keeps x/y/vx/vy), then
      // links (forceLink resolves ends against the current nodes).
      simulation.nodes(visibleNodes);
      linkForce.links(visibleLinks);
      join(visibleNodes, visibleLinks, visible.contextIds);
      // A removed node never fires mouseleave.
      if (hoveredId !== null && !visibleIds.has(hoveredId)) hoveredId = null;
      if (selectedId !== null && !visibleIds.has(selectedId)) selectedId = null;
      paint();

      if (visibleNodes.length === 0) {
        fitOnEnd = 'none';
        simulation.stop();
        return;
      }
      draw();
      fitOnEnd = 'unlessMoved';
      simulation.alpha(UPDATE_ALPHA).restart();
    },
    setSelection(id: string | null) {
      if (destroyed) return;
      const next = id !== null && visibleIds.has(id) ? id : null;
      if (next === selectedId) return;
      selectedId = next;
      paint();
    },
    focusOn(id: string) {
      if (destroyed || !visibleIds.has(id)) return;
      const n = nodeById.get(id);
      const w = svgEl.clientWidth;
      const h = svgEl.clientHeight;
      if (!n || !w || !h) return;
      const k = Math.max(zoomTransform(svgEl).k, FOCUS_MIN_SCALE);
      svg.call(
        zoomBehavior.transform,
        zoomIdentity.translate(w / 2 - k * (n.x ?? 0), h / 2 - k * (n.y ?? 0)).scale(k),
      );
    },
    setLabelMode(mode: LabelMode) {
      if (destroyed || mode === labelMode) return;
      labelMode = mode;
      applyLabelModeClass();
      paintLabels();
    },
    setQuery(next: ReadonlySet<string>) {
      if (destroyed || sameIdSet(next, matchIds)) return;
      matchIds = new Set(next);
      paint();
    },
    zoomBy(factor: number) {
      if (destroyed) return;
      userMoved = true;
      svg.call(zoomBehavior.scaleBy, factor);
    },
    fit() {
      if (destroyed) return;
      userMoved = false;
      fit();
    },
    relayout() {
      if (destroyed) return;
      simulation.stop();
      fitOnEnd = 'none';
      userMoved = false;
      if (visibleNodes.length === 0) return;
      for (const n of allNodes) {
        n.fx = null;
        n.fy = null;
      }
      for (const n of visibleNodes) {
        n.x = (Math.random() - 0.5) * 2 * RELAYOUT_SPREAD;
        n.y = (Math.random() - 0.5) * 2 * RELAYOUT_SPREAD;
        n.vx = 0;
        n.vy = 0;
      }
      simulation.alpha(1);
      if (visibleNodes.length <= PRETICK_MAX_NODES) {
        simulation.tick(PRETICKS);
        draw();
        fit();
      } else {
        draw();
        fitOnEnd = 'always';
        simulation.restart();
      }
    },
    setDistance(d: number) {
      if (destroyed || d === distance) return;
      distance = d;
      applyForces();
      if (visibleNodes.length === 0) return;
      fitOnEnd = 'unlessMoved';
      simulation.alpha(DISTANCE_ALPHA).restart();
    },
    positions() {
      const out = new Map<string, Point>();
      for (const n of allNodes) {
        if (n.x !== undefined && n.y !== undefined) out.set(n.id, { x: n.x, y: n.y });
      }
      return out;
    },
    viewState() {
      const t = zoomTransform(svgEl);
      return { transform: { x: t.x, y: t.y, k: t.k }, userMoved };
    },
    destroy() {
      destroyed = true;
      hoveredId = null;
      selectedId = null;
      pendingReheat.clear();
      simulation.stop();
      simulation.on('tick', null).on('end', null);
      nodeSel
        .on('.drag', null)
        .on('click', null)
        .on('keydown', null)
        .on('mouseenter', null)
        .on('mouseleave', null)
        .on('focus', null)
        .on('blur', null);
      svg.on('.zoom', null).on('click', null);
      // `interrupt` is patched onto selections by d3-transition, which d3-zoom
      // imports; no transitions are started here, this is belt and braces.
      (svg as unknown as { interrupt?: () => void }).interrupt?.();
      svg.selectAll('*').remove();
      svg.classed(styles.root, false).classed(styles.labelsAll, false).classed(styles.labelsFocus, false);
    },
  };
}
