export type RecordEditPathArgs = {
  isEnvironmentPrimary: boolean;
  environment: string;
  itemTypeId: string;
  itemId: string;
};

export function recordEditPath({
  isEnvironmentPrimary,
  environment,
  itemTypeId,
  itemId,
}: RecordEditPathArgs): string {
  const prefix = isEnvironmentPrimary ? '' : `/environments/${environment}`;
  return `${prefix}/editor/item_types/${itemTypeId}/items/${itemId}/edit`;
}
