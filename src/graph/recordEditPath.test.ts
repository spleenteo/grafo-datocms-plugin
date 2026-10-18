import { describe, expect, it } from 'vitest';
import { recordEditPath } from './recordEditPath';

describe('recordEditPath', () => {
  it('has no prefix on the primary environment', () => {
    expect(
      recordEditPath({ isEnvironmentPrimary: true, environment: 'main', itemTypeId: '10', itemId: '20' }),
    ).toBe('/editor/item_types/10/items/20/edit');
  });
  it('prefixes a sandbox environment', () => {
    expect(
      recordEditPath({ isEnvironmentPrimary: false, environment: 'dev', itemTypeId: '10', itemId: '20' }),
    ).toBe('/environments/dev/editor/item_types/10/items/20/edit');
  });
});
