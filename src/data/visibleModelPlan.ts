import { readAccess } from './readAccess';
import type { Permissions, Schema, SchemaItemType } from './types';

export type VisibleModelPlan = {
  /** Ids of the (non-block) models to list: readable by the role and not excluded. */
  modelIds: string[];
  /** The full schema minus unreadable and excluded models; block models stay. */
  schema: Schema;
  /** Computed over every model, before exclusions. */
  isFullRead: boolean;
};

/**
 * readAccess runs over ALL models, then excluded models are dropped: removing a
 * model from the list must never turn a restricted role into full read.
 */
export function visibleModelPlan(
  schema: Schema,
  permissions: Permissions,
  environment: string,
  excludedModelApiKeys: readonly string[],
): VisibleModelPlan {
  const allModelIds = [...schema.itemTypes.values()].filter((t) => !t.isBlock).map((t) => t.id);
  const access = readAccess(permissions, environment, allModelIds);
  const excluded = new Set(excludedModelApiKeys);
  const readable = access.readableModelIds;
  const modelIds: string[] = [];
  const itemTypes = new Map<string, SchemaItemType>();
  for (const [id, t] of schema.itemTypes) {
    if (t.isBlock) itemTypes.set(id, t);
    else if (readable.has(id) && !excluded.has(t.apiKey)) {
      modelIds.push(id);
      itemTypes.set(id, t);
    }
  }
  return {
    modelIds,
    schema: { locales: schema.locales, itemTypes },
    isFullRead: access.isFullRead,
  };
}
