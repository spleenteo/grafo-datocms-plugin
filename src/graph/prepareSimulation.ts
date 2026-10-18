import type { SimulationLinkDatum, SimulationNodeDatum } from 'd3-force';
import type { Graph, NodeStatus } from '../data/types';

export interface SimNode extends SimulationNodeDatum {
  id: string;
  title: string;
  itemTypeId: string;
  model: number;
  status: NodeStatus;
  degree: number;
  r: number;
}

export interface SimLink extends SimulationLinkDatum<SimNode> {
  field: number;
}

export function nodeRadius(degree: number): number {
  return Math.min(20, 5 + Math.sqrt(degree) * 1.6);
}

export function prepareSimulation(graph: Graph): {
  nodes: SimNode[];
  links: SimLink[];
  colorIndex: number[];
} {
  const degrees = new Array<number>(graph.nodes.length).fill(0);
  const links: SimLink[] = [];
  for (const e of graph.edges) {
    if (e.source === e.target) continue;
    degrees[e.source]++;
    degrees[e.target]++;
    links.push({ source: e.source, target: e.target, field: e.field });
  }

  const nodes: SimNode[] = graph.nodes.map((n, i) => ({
    id: n.id,
    title: n.title,
    itemTypeId: n.itemTypeId,
    model: n.model,
    status: n.status,
    degree: degrees[i],
    r: nodeRadius(degrees[i]),
  }));

  const order = graph.models
    .map((_, i) => i)
    .sort((a, b) => {
      const ma = graph.models[a];
      const mb = graph.models[b];
      if (mb.count !== ma.count) return mb.count - ma.count;
      return ma.apiKey < mb.apiKey ? -1 : ma.apiKey > mb.apiKey ? 1 : 0;
    });
  const colorIndex = new Array<number>(graph.models.length).fill(0);
  order.forEach((modelIdx, pos) => {
    colorIndex[modelIdx] = pos;
  });

  return { nodes, links, colorIndex };
}
