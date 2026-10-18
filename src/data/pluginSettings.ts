export const DEFAULT_EXCLUDED_MODEL_API_KEYS = ['schema_migration'];

export type PluginSettings = {
  startingModelApiKeys: string[];
  excludedModelApiKeys: string[];
};

function strings(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  return value.filter((v): v is string => typeof v === 'string');
}

/** Defensive read of the plugin parameters; an absent excluded list falls back to the default. */
export function readPluginSettings(parameters: unknown): PluginSettings {
  const p =
    typeof parameters === 'object' && parameters !== null
      ? (parameters as Record<string, unknown>)
      : {};
  return {
    startingModelApiKeys: strings(p.startingModelApiKeys) ?? [],
    excludedModelApiKeys: strings(p.excludedModelApiKeys) ?? [...DEFAULT_EXCLUDED_MODEL_API_KEYS],
  };
}
