// Which models the current role can read. Conservative: anything unexpected
// means "not full read", so the loader falls back to the nested, per-model path.

type Entry = {
  action: string;
  environment: string;
  itemType: string | null;
  workflow: boolean;
  onCreatorAnyone: boolean;
  stageScoped: boolean;
  plain: boolean;
};

const KNOWN_KEYS = new Set([
  'action',
  'environment',
  'item_type',
  'workflow',
  'on_creator',
  'on_stage',
  'to_stage',
  'localization_scope',
  'locale',
]);

export type ReadAccess = {
  readableModelIds: Set<string>;
  isFullRead: boolean;
};

type Permissions = {
  positive_item_type_permissions: unknown[];
  negative_item_type_permissions: unknown[];
};

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const isSet = (value: unknown): boolean => value !== undefined && value !== null;

const parseEntry = (raw: unknown): Entry | null => {
  if (!isObject(raw)) return null;
  const { action, environment, item_type: itemType } = raw;
  if (typeof action !== 'string' || typeof environment !== 'string') return null;
  // an unexpected item_type shape could cover anything: treat as malformed
  if (isSet(itemType) && typeof itemType !== 'string') return null;
  return {
    action,
    environment,
    itemType: typeof itemType === 'string' ? itemType : null,
    workflow: isSet(raw.workflow),
    onCreatorAnyone: raw.on_creator === 'anyone',
    stageScoped: isSet(raw.on_stage) || isSet(raw.to_stage),
    // no unknown key carrying a value, no locale/localization restriction
    plain:
      Object.entries(raw).every(([k, v]) => !isSet(v) || KNOWN_KEYS.has(k)) &&
      (!isSet(raw.localization_scope) || raw.localization_scope === 'all') &&
      !isSet(raw.locale),
  };
};

const isReadAction = (action: string): boolean =>
  action === 'all' || action === 'read';

const covers = (entry: Entry, modelId: string): boolean =>
  entry.itemType === null || entry.itemType === modelId;

export const readAccess = (
  permissions: Permissions,
  environment: string,
  modelIds: string[],
): ReadAccess => {
  let wellFormed = true;
  let negativeCoversAll = false;
  const parse = (raws: unknown[], isNegative: boolean): Entry[] => {
    const entries: Entry[] = [];
    for (const raw of raws) {
      const entry = parseEntry(raw);
      if (entry === null) {
        wellFormed = false;
        // a malformed negative entry may deny anything: it covers every model,
        // unless it is clearly scoped to another environment
        const otherEnv =
          isObject(raw) && typeof raw.environment === 'string' && raw.environment !== environment;
        if (isNegative && !otherEnv) negativeCoversAll = true;
      } else if (entry.environment === environment && isReadAction(entry.action)) {
        entries.push(entry);
      }
    }
    return entries;
  };

  const positive = parse(permissions.positive_item_type_permissions, false);
  const negative = parse(permissions.negative_item_type_permissions, true);

  const readableModelIds = new Set<string>();
  for (const id of modelIds) {
    const granted = positive.some((e) => !e.workflow && covers(e, id));
    if (granted && !negativeCoversAll && !negative.some((e) => covers(e, id))) readableModelIds.add(id);
  }

  const unrestricted = (e: Entry) =>
    e.onCreatorAnyone && !e.workflow && !e.stageScoped && e.plain;
  const isFullRead =
    wellFormed &&
    modelIds.length > 0 &&
    negative.length === 0 &&
    modelIds.every((id) => positive.some((e) => unrestricted(e) && covers(e, id)));

  return { readableModelIds, isFullRead };
};
