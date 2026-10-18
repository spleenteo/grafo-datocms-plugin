import type { RenderConfigScreenCtx } from 'datocms-plugin-sdk';
import { Button, Canvas, FieldGroup, Form, SelectField } from 'datocms-react-ui';
import { useMemo, useState } from 'react';
import { readPluginSettings } from '../data/pluginSettings';
import styles from './ConfigScreen.module.css';

type Option = { label: string; value: string };

export default function ConfigScreen({ ctx }: { ctx: RenderConfigScreenCtx }) {
  const canEdit = ctx.currentRole.meta.final_permissions.can_edit_schema;

  const allOptions = useMemo<Option[]>(
    () =>
      Object.values(ctx.itemTypes)
        .filter((m) => m !== undefined && !m.attributes.modular_block)
        .map((m) => ({ label: m!.attributes.name, value: m!.attributes.api_key }))
        .sort((a, b) => a.label.localeCompare(b.label)),
    [ctx.itemTypes],
  );

  const existing = useMemo(() => new Set(allOptions.map((o) => o.value)), [allOptions]);
  const saved = readPluginSettings(ctx.plugin.attributes.parameters);

  const [excluded, setExcluded] = useState<string[]>(
    saved.excludedModelApiKeys.filter((k) => existing.has(k)),
  );
  const [starting, setStarting] = useState<string[]>(() => {
    const ex = new Set(saved.excludedModelApiKeys);
    return saved.startingModelApiKeys.filter((k) => existing.has(k) && !ex.has(k));
  });
  const [saving, setSaving] = useState(false);

  const byKey = (keys: string[]) =>
    keys.map((k) => allOptions.find((o) => o.value === k)).filter((o): o is Option => !!o);
  const startingOptions = allOptions.filter((o) => !excluded.includes(o.value));

  async function save() {
    setSaving(true);
    try {
      await ctx.updatePluginParameters({
        ...(ctx.plugin.attributes.parameters ?? {}),
        startingModelApiKeys: starting,
        excludedModelApiKeys: excluded,
      });
      await ctx.notice('Settings saved.');
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await ctx.alert(`Settings could not be saved: ${message}`);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Canvas ctx={ctx}>
      <div className={styles.root}>
        <Form
          onSubmit={(e) => {
            e.preventDefault();
            if (canEdit) void save();
          }}
        >
          <FieldGroup>
            <SelectField
              name="excludedModels"
              id="excludedModels"
              label="Excluded models"
              hint="Never loaded nor shown in Grafo. The migrations model is excluded by default."
              value={byKey(excluded)}
              onChange={(next) => {
                const keys = next.map((o) => o.value);
                setExcluded(keys);
                setStarting((s) => s.filter((k) => !keys.includes(k)));
              }}
              selectInputProps={{
                isMulti: true,
                isDisabled: !canEdit,
                options: allOptions,
                menuPlacement: 'auto',
              }}
            />
            <SelectField
              name="startingModels"
              id="startingModels"
              label="Starting models"
              hint="Grafo opens with these models selected and shows their linked records as context. Leave empty to start with every model."
              value={byKey(starting)}
              onChange={(next) => setStarting(next.map((o) => o.value))}
              selectInputProps={{
                isMulti: true,
                isDisabled: !canEdit,
                options: startingOptions,
                menuPlacement: 'auto',
              }}
            />
            {canEdit ? (
              <Button type="submit" buttonType="primary" disabled={saving}>
                Save
              </Button>
            ) : (
              <p className={styles.note}>Only administrators can change these settings.</p>
            )}
          </FieldGroup>
        </Form>
      </div>
    </Canvas>
  );
}
