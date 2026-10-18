export interface AdjacencyLink {
  source: string;
  target: string;
  edge: number;
}

export interface Adjacency {
  /** Other ends of a node's links, each once, in first-link order; never the node itself. */
  neighbours: Map<string, string[]>;
  /** Edge indexes of the links touching a node, in link order. */
  incident: Map<string, number[]>;
}

export function buildAdjacency(links: Iterable<AdjacencyLink>): Adjacency {
  const neighbours = new Map<string, string[]>();
  const seen = new Map<string, Set<string>>();
  const incident = new Map<string, number[]>();
  const addNeighbour = (id: string, other: string) => {
    let s = seen.get(id);
    if (!s) {
      s = new Set();
      seen.set(id, s);
      neighbours.set(id, []);
    }
    if (s.has(other)) return;
    s.add(other);
    neighbours.get(id)?.push(other);
  };
  const addIncident = (id: string, edge: number) => {
    const list = incident.get(id);
    if (list) list.push(edge);
    else incident.set(id, [edge]);
  };
  for (const { source, target, edge } of links) {
    addIncident(source, edge);
    if (target === source) continue;
    addIncident(target, edge);
    addNeighbour(source, target);
    addNeighbour(target, source);
  }
  return { neighbours, incident };
}

/** Members of exactly one of the two sets, split by side. */
export function diffSets<T>(prev: ReadonlySet<T>, next: ReadonlySet<T>): { added: T[]; removed: T[] } {
  const added: T[] = [];
  const removed: T[] = [];
  for (const v of next) if (!prev.has(v)) added.push(v);
  for (const v of prev) if (!next.has(v)) removed.push(v);
  return { added, removed };
}
