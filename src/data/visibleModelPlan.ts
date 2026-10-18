import { readAccess } from './readAccess';
import type { Permissions, Schema } from './types';

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
  const loaded = new Set(
    [...access.readableModelIds].filter(
      (id) => !excluded.has(schema.itemTypes.get(id)?.apiKey ?? ''),
    ),
  );
  const itemTypes = new Map(
    [...schema.itemTypes].filter(([id, t]) => t.isBlock || loaded.has(id)),
  );
  return {
    modelIds: allModelIds.filter((id) => loaded.has(id)),
    schema: { locales: schema.locales, itemTypes },
    isFullRead: access.isFullRead,
  };
}
