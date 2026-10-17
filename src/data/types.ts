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

export type Graph = {
  models: { itemTypeId: string; apiKey: string; name: string; count: number }[];
  fields: { apiKey: string; isPseudo: boolean }[];
  nodes: { id: string; title: string; itemTypeId: string; status: NodeStatus }[];
  edges: { source: number; target: number; field: number }[];
};
