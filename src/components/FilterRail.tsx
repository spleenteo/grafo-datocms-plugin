import { Button, ButtonGroup, ButtonGroupButton, SwitchField } from 'datocms-react-ui';
import { useMemo } from 'react';
import { allFilters, type Filters } from '../data/filterGraph';
import type { Graph, NodeStatus } from '../data/types';
import { modelColor } from '../graph/modelColor';
import styles from './FilterRail.module.css';

interface Props {
  graph: Graph;
  colorIndex: number[];
  filters: Filters;
  onChange: (update: (prev: Filters) => Filters) => void;
}

const STATUSES: { status: NodeStatus; label: string }[] = [
  { status: 'published', label: 'Published' },
  { status: 'updated', label: 'Updated' },
  { status: 'draft', label: 'Draft' },
];

const DIRECTIONS: { direction: Filters['direction']; label: string }[] = [
  { direction: 'both', label: 'Both' },
  { direction: 'out', label: 'Out' },
  { direction: 'in', label: 'In' },
];

function toggled<T>(set: ReadonlySet<T>, value: T): Set<T> {
  const next = new Set(set);
  if (!next.delete(value)) next.add(value);
  return next;
}

function GroupHeader({
  title,
  onAll,
  onNone,
}: {
  title: string;
  onAll: () => void;
  onNone: () => void;
}) {
  return (
    <div className={styles.header}>
      <span>{title}</span>
      <span className={styles.headerActions}>
        <Button buttonType="muted" buttonSize="xxs" onClick={onAll}>
          All
        </Button>
        <Button buttonType="muted" buttonSize="xxs" onClick={onNone}>
          None
        </Button>
      </span>
    </div>
  );
}

export default function FilterRail({ graph, colorIndex, filters, onChange }: Props) {
  const set = (patch: Partial<Filters>) => onChange((prev) => ({ ...prev, ...patch }));
  const toggle = (key: 'models' | 'statuses' | 'fields', value: number | NodeStatus) =>
    onChange((prev) => ({ ...prev, [key]: toggled(prev[key] as ReadonlySet<number | NodeStatus>, value) }));

  const modelOrder = useMemo(
    () => graph.models.map((_, i) => i).sort((a, b) => colorIndex[a] - colorIndex[b]),
    [graph, colorIndex],
  );
  const statusCounts = useMemo(() => {
    const counts: Record<NodeStatus, number> = { published: 0, updated: 0, draft: 0 };
    for (const n of graph.nodes) counts[n.status] += 1;
    return counts;
  }, [graph]);
  const fieldOrder = useMemo(() => {
    const counts = new Array<number>(graph.fields.length).fill(0);
    for (const e of graph.edges) if (e.source !== e.target) counts[e.field] += 1;
    return graph.fields
      .map((_, i) => i)
      .sort((a, b) => counts[b] - counts[a] || graph.fields[a].apiKey.localeCompare(graph.fields[b].apiKey))
      .map((i) => ({ index: i, count: counts[i] }));
  }, [graph]);

  return (
    <aside className={styles.rail}>
      <section className={styles.section}>
        <GroupHeader
          title="Models"
          onAll={() => set({ models: allFilters(graph).models })}
          onNone={() => set({ models: new Set() })}
        />
        <div className={styles.models}>
          {modelOrder.map((m) => {
            const isOn = filters.models.has(m);
            return (
              <div
                key={m}
                className={`${styles.model} ${isOn ? styles.on : styles.off}`}
                role="button"
                tabIndex={0}
                aria-pressed={isOn}
                onClick={() => toggle('models', m)}
                onDoubleClick={() => set({ models: new Set([m]) })}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    toggle('models', m);
                  }
                }}
              >
                <span className={styles.dot} style={{ background: modelColor(colorIndex[m]) }} />
                <span className={styles.modelName}>{graph.models[m].name}</span>
                <span className={styles.count}>{graph.models[m].count}</span>
              </div>
            );
          })}
        </div>
      </section>

      <section className={styles.section}>
        <GroupHeader
          title="Status"
          onAll={() => set({ statuses: allFilters(graph).statuses })}
          onNone={() => set({ statuses: new Set() })}
        />
        <div className={styles.chips}>
          {STATUSES.map(({ status, label }) => (
            <button
              key={status}
              type="button"
              className={`${styles.chip} ${filters.statuses.has(status) ? styles.on : styles.chipOff}`}
              title={`${statusCounts[status]} records`}
              aria-pressed={filters.statuses.has(status)}
              onClick={() => toggle('statuses', status)}
            >
              {label}
            </button>
          ))}
        </div>
      </section>

      <section className={styles.section}>
        <GroupHeader
          title="Relation fields"
          onAll={() => set({ fields: allFilters(graph).fields })}
          onNone={() => set({ fields: new Set() })}
        />
        <div className={styles.chips}>
          {fieldOrder.map(({ index, count }) => {
            const field = graph.fields[index];
            const isOn = filters.fields.has(index);
            return (
              <button
                key={index}
                type="button"
                className={`${styles.chip} ${isOn ? styles.on : styles.chipOff}`}
                title={`${count} relations`}
                aria-pressed={isOn}
                onClick={() => toggle('fields', index)}
              >
                {field.isPseudo ? 'parent (tree)' : field.apiKey}
              </button>
            );
          })}
        </div>
      </section>

      <section className={styles.section}>
        <SwitchField
          id="grafo-outside"
          name="grafo-outside"
          label="Relations outside selection"
          value={filters.showsOutside}
          onChange={(showsOutside) => set({ showsOutside })}
        />
        {filters.showsOutside && (
          <ButtonGroup>
            {DIRECTIONS.map(({ direction, label }) => (
              <ButtonGroupButton
                key={direction}
                selected={filters.direction === direction}
                onClick={() => set({ direction })}
              >
                {label}
              </ButtonGroupButton>
            ))}
          </ButtonGroup>
        )}
        <SwitchField
          id="grafo-orphans"
          name="grafo-orphans"
          label="Hide orphans"
          value={filters.hidesOrphans}
          onChange={(hidesOrphans) => set({ hidesOrphans })}
        />
      </section>

      <Button buttonType="muted" buttonSize="s" onClick={() => onChange(() => allFilters(graph))}>
        Reset filters
      </Button>
    </aside>
  );
}
