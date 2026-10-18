export type ModelSort = 'count' | 'name';

type Listed = { name: string; apiKey: string };

/** Lowercased, accents removed: the form both sides of a search are compared in. */
export const normalizeForSearch = (text: string): string =>
  text.normalize('NFD').replace(/\p{M}+/gu, '').toLowerCase();

/** Name without its leading emoji, symbols and spaces, lowercased: what the list sorts and searches on. */
export function modelSortName(name: string): string {
  return name.replace(/^[^\p{L}\p{N}]+/u, '').toLowerCase();
}

/** Whether the model's name or api key contains the query, ignoring case and accents. */
export function matchesModel(model: Listed, query: string): boolean {
  const needle = normalizeForSearch(query.trim());
  if (!needle) return true;
  return (
    normalizeForSearch(modelSortName(model.name)).includes(needle) ||
    normalizeForSearch(model.apiKey).includes(needle)
  );
}

/** Indices of the models matching the query, in the requested order; ties end on the index. */
export function orderModels(
  models: readonly (Listed & { count: number })[],
  sort: ModelSort,
  query: string,
): number[] {
  const byName = (a: number, b: number) =>
    modelSortName(models[a].name).localeCompare(modelSortName(models[b].name));
  const byCount = (a: number, b: number) => models[b].count - models[a].count;
  const compare = sort === 'count' ? [byCount, byName] : [byName, byCount];
  return models
    .map((_, i) => i)
    .filter((i) => matchesModel(models[i], query))
    .sort((a, b) => compare[0](a, b) || compare[1](a, b) || a - b);
}
