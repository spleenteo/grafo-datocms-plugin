import type { ApiTypes } from '@datocms/cma-client-browser';

export type RawItem = ApiTypes.Item;

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
