import { describe, expect, it } from 'vitest';
import { matchesModel, modelSortName, normalizeForSearch, orderModels } from './modelList';

const model = (name: string, apiKey: string, count: number) => ({ name, apiKey, count });
const models = [
  model('🏠 Apartments', 'apartment', 5),
  model('Zebra', 'zebra', 9),
  model('Café', 'cafe_page', 5),
  model('Gallery Image', 'gallery_image', 1),
];

describe('modelSortName', () => {
  it('strips a leading emoji, symbols and spaces', () => {
    expect(modelSortName('🏠 Apartments')).toBe('apartments');
    expect(modelSortName('⁉️ Faq')).toBe('faq');
  });
});

describe('orderModels', () => {
  it('orders by count, breaking a tie by name', () => {
    expect(orderModels(models, 'count', '')).toEqual([1, 0, 2, 3]);
  });
  it('orders by name ignoring the emoji', () => {
    expect(orderModels(models, 'name', '')).toEqual([0, 2, 3, 1]);
  });
  it('keeps everything for an empty or blank query', () => {
    expect(orderModels(models, 'name', '')).toHaveLength(4);
    expect(orderModels(models, 'name', '   ')).toHaveLength(4);
  });
});

describe('matchesModel', () => {
  it('matches the name ignoring case and accents', () => {
    expect(matchesModel(models[2], 'CAFE')).toBe(true);
    expect(matchesModel(models[2], 'café')).toBe(true);
  });
  it('matches the api key', () => {
    expect(matchesModel(models[2], 'cafe_p')).toBe(true);
    expect(orderModels(models, 'count', 'gal')).toEqual([3]);
  });
});

describe('normalizeForSearch', () => {
  it('lowercases and removes accents', () => {
    expect(normalizeForSearch('Café ÀB')).toBe('cafe ab');
  });
});
