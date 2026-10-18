import type { ApiTypes } from '@datocms/cma-client-browser';

/** A record or block from a flat listing: block fields hold block IDs. */
export type RawItem = ApiTypes.Item;
/** A record from a `nested: true` listing: block fields hold inline block objects. */
export type RawNestedItem = ApiTypes.ItemInNestedResponse;
/** Either listing shape; `buildGraph` accepts both. */
export type RawRecord = RawItem | RawNestedItem;

export type SchemaField = {
  id: string;
  apiKey: string;
  fieldType: string;
  isLocalized: boolean;
};

export type SchemaItemType = {
  id: string;
  apiKey: string;
  name: string;
  isBlock: boolean;
  isTree: boolean;
  titleFieldApiKey: string | null;
  fields: SchemaField[];
};

export type Schema = {
  locales: string[];
  itemTypes: Map<string, SchemaItemType>;
};

export type NodeStatus = 'published' | 'updated' | 'draft';

export type GraphModel = {
  readonly itemTypeId: string;
  readonly apiKey: string;
  readonly name: string;
  count: number;
};
export type GraphField = { readonly apiKey: string; readonly isPseudo: boolean };
export type GraphNode = {
  readonly id: string;
  readonly title: string;
  readonly itemTypeId: string;
  /** Index into `graph.models` of the node's item type. */
  readonly model: number;
  readonly status: NodeStatus;
};
export type GraphEdge = {
  readonly source: number;
  readonly target: number;
  readonly field: number;
};

export type Graph = {
  readonly models: readonly Readonly<GraphModel>[];
  readonly fields: readonly GraphField[];
  readonly nodes: readonly GraphNode[];
  readonly edges: readonly GraphEdge[];
};
