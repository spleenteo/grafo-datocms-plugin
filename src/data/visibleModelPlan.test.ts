import { describe, expect, it } from 'vitest';
import type { Schema, SchemaItemType } from './types';
import { visibleModelPlan } from './visibleModelPlan';

const ENV = 'main';
const type = (id: string, isBlock = false): SchemaItemType => ({
  id,
  apiKey: `key_${id}`,
  name: id,
  isBlock,
  isTree: false,
  titleFieldApiKey: null,
  fields: [],
});
const schema: Schema = {
  locales: ['en'],
  itemTypes: new Map([type('m1'), type('m2'), type('m3'), type('b1', true)].map((t) => [t.id, t])),
};
const allow = (itemType: string | null) => ({
  action: 'read',
  environment: ENV,
  on_creator: 'anyone',
  item_type: itemType,
});
const fullRead = { positive_item_type_permissions: [allow(null)], negative_item_type_permissions: [] };
const noM3 = {
  positive_item_type_permissions: [allow('m1'), allow('m2')],
  negative_item_type_permissions: [],
};

describe('visibleModelPlan', () => {
  it('without exclusions lists every readable model and keeps blocks', () => {
    const plan = visibleModelPlan(schema, fullRead, ENV, []);
    expect(plan.modelIds).toEqual(['m1', 'm2', 'm3']);
    expect([...plan.schema.itemTypes.keys()].sort()).toEqual(['b1', 'm1', 'm2', 'm3']);
    expect(plan.isFullRead).toBe(true);
  });

  it('an excluded model leaves modelIds and the schema; blocks stay', () => {
    const plan = visibleModelPlan(schema, fullRead, ENV, ['key_m2']);
    expect(plan.modelIds).toEqual(['m1', 'm3']);
    expect(plan.schema.itemTypes.has('m2')).toBe(false);
    expect(plan.schema.itemTypes.has('b1')).toBe(true);
  });

  it('excluding the only model a restricted role cannot read keeps isFullRead false', () => {
    expect(visibleModelPlan(schema, noM3, ENV, []).isFullRead).toBe(false);
    const plan = visibleModelPlan(schema, noM3, ENV, ['key_m3']);
    expect(plan.isFullRead).toBe(false);
    expect(plan.modelIds).toEqual(['m1', 'm2']);
  });

  it('never exposes a model the role cannot read, excluded or not', () => {
    const plan = visibleModelPlan(schema, noM3, ENV, ['key_m1']);
    expect(plan.modelIds).toEqual(['m2']);
    expect(plan.schema.itemTypes.has('m3')).toBe(false);
  });
});
