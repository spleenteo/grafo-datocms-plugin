import { describe, expect, it } from 'vitest';
import { readPluginSettings } from './pluginSettings';

describe('readPluginSettings', () => {
  it('defaults on bad shapes', () => {
    for (const bad of [undefined, null, 'x', 3, [], {}]) {
      expect(readPluginSettings(bad)).toEqual({
        startingModelApiKeys: [],
        excludedModelApiKeys: ['schema_migration'],
      });
    }
  });

  it('ignores non-array values and non-string entries', () => {
    expect(
      readPluginSettings({ startingModelApiKeys: 'a', excludedModelApiKeys: ['x', 1, null] }),
    ).toEqual({ startingModelApiKeys: [], excludedModelApiKeys: ['x'] });
  });

  it('keeps an explicitly saved empty excluded list', () => {
    expect(readPluginSettings({ excludedModelApiKeys: [] }).excludedModelApiKeys).toEqual([]);
  });

  it('reads saved values', () => {
    expect(
      readPluginSettings({ startingModelApiKeys: ['a', 'b'], excludedModelApiKeys: ['c'] }),
    ).toEqual({ startingModelApiKeys: ['a', 'b'], excludedModelApiKeys: ['c'] });
  });
});
