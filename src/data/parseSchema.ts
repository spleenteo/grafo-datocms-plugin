import type { RawApiTypes } from '@datocms/cma-client-browser';
import type { Schema, SchemaField, SchemaItemType } from './types';

export function parseSchema(site: RawApiTypes.SiteSelfTargetSchema): Schema {
  const included = site.included ?? [];
  const fieldsById = new Map<string, RawApiTypes.Field>();
  const rawItemTypes: RawApiTypes.ItemType[] = [];

  for (const resource of included) {
    if (resource.type === 'field') fieldsById.set(resource.id, resource);
    else if (resource.type === 'item_type') rawItemTypes.push(resource);
  }

  const fieldsByItemType = new Map<string, SchemaField[]>();
  for (const field of fieldsById.values()) {
    const itemTypeId = field.relationships.item_type.data.id;
    const list = fieldsByItemType.get(itemTypeId) ?? [];
    list.push({
      id: field.id,
      apiKey: field.attributes.api_key,
      fieldType: field.attributes.field_type,
      isLocalized: field.attributes.localized,
    });
    fieldsByItemType.set(itemTypeId, list);
  }

  const itemTypes = new Map<string, SchemaItemType>();
  for (const raw of rawItemTypes) {
    const titleRef =
      raw.relationships.presentation_title_field?.data ??
      raw.relationships.title_field?.data ??
      null;
    itemTypes.set(raw.id, {
      id: raw.id,
      apiKey: raw.attributes.api_key,
      name: raw.attributes.name,
      isBlock: raw.attributes.modular_block,
      isTree: raw.attributes.tree,
      titleFieldApiKey: titleRef
        ? (fieldsById.get(titleRef.id)?.attributes.api_key ?? null)
        : null,
      fields: fieldsByItemType.get(raw.id) ?? [],
    });
  }

  return { locales: [...site.data.attributes.locales], itemTypes };
}
