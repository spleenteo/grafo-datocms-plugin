import type { RawApiTypes } from '@datocms/cma-client-browser';
import type { Schema, SchemaField, SchemaItemType } from './types';

export function parseSchema(site: RawApiTypes.SiteSelfTargetSchema): Schema {
  const fieldsById = new Map<string, RawApiTypes.Field>();
  const rawItemTypes: RawApiTypes.ItemType[] = [];
  const fieldsByItemType = new Map<string, SchemaField[]>();

  for (const resource of site.included ?? []) {
    if (resource.type === 'field') {
      fieldsById.set(resource.id, resource);
      const itemTypeId = resource.relationships.item_type.data.id;
      let list = fieldsByItemType.get(itemTypeId);
      if (!list) fieldsByItemType.set(itemTypeId, (list = []));
      list.push({
        id: resource.id,
        apiKey: resource.attributes.api_key,
        fieldType: resource.attributes.field_type,
        isLocalized: resource.attributes.localized,
      });
    } else if (resource.type === 'item_type') rawItemTypes.push(resource);
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
