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
export const NODE_STATUSES: readonly NodeStatus[] = ['published', 'updated', 'draft'];

/** The two arrays of `ctx.currentRole.meta.final_permissions` that decide read access. */
export type Permissions = {
  positive_item_type_permissions: unknown[];
  negative_item_type_permissions: unknown[];
};

export const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

export type GraphModel = {
  readonly itemTypeId: string;
  readonly apiKey: string;
  readonly name: string;
  count: number;
};
export type GraphField = { readonly apiKey: string; readonly isPseudo: boolean };
/** Identity of a field across graphs: pseudo (tree) fields never collide with real ones. */
export const fieldKey = (f: GraphField): string => `${f.isPseudo ? 1 : 0}:${f.apiKey}`;
export type GraphNode = {
  readonly id: string;
  readonly title: string;
  readonly itemTypeId: string;
  /** Index into `graph.models` of the node's item type. */
  readonly model: number;
  readonly status: NodeStatus;
  readonly createdAt: string | null;
  readonly updatedAt: string | null;
  readonly publishedAt: string | null;
  /** Who created the record (`item.creator`), when the API returns it. */
  readonly creator: { readonly type: string; readonly id: string } | null;
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

/** Display name of a field; the tree pseudo-field has no api key worth showing. */
export const fieldLabel = (field: GraphField): string =>
  field.isPseudo ? 'parent (tree)' : field.apiKey;
