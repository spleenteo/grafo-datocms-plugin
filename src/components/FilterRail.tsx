import { Button, ButtonGroup, ButtonGroupButton, SwitchField, TextInput } from 'datocms-react-ui';
import { memo, useMemo, useState, type KeyboardEvent } from 'react';
import { fieldStats, linksInto } from '../data/fieldStats';
import { normalizeForSearch, orderModels, withoutLeadingSymbols, type ModelSort } from '../data/modelList';
import { fieldLabel, fieldTitle } from '../data/types';
import { allFilters, type Filters } from '../data/filterGraph';
import type { Graph, NodeStatus } from '../data/types';
import { NODE_STATUSES } from '../data/types';
import { modelColor } from '../graph/modelColor';
import { STATUS_LABEL } from './labels';
import styles from './FilterRail.module.css';

interface Props {
  graph: Graph;
  colorIndex: number[];
  filters: Filters;
  onChange: (update: (prev: Filters) => Filters) => void;
  resetFilters: () => Filters;
  onHelp: () => void;
}

// Rows shown before "Show all"; a list only a few rows longer is shown whole.
const MODEL_ROWS = 10;
const MODEL_ROWS_SLACK = 3;
const FIELD_SEARCH_MIN = 10;
const SORT_KEY = 'grafo:modelSort:v1';

function readSort(): ModelSort {
  try {
    return localStorage.getItem(SORT_KEY) === 'name' ? 'name' : 'count';
  } catch {
    return 'count';
  }
}

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
  isCollapsed,
  onToggleCollapse,
}: {
  title: string;
  onAll: () => void;
  onNone: () => void;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
}) {
  return (
    <div className={styles.header}>
      {onToggleCollapse ? (
        <button
          type="button"
          className={styles.collapse}
          aria-expanded={!isCollapsed}
          onClick={onToggleCollapse}
        >
          <span aria-hidden="true">{isCollapsed ? '▸' : '▾'}</span> {title}
        </button>
      ) : (
        <span>{title}</span>
      )}
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

// Column header that sorts the list: name ascending, records descending.
function SortHeader({
  label,
  sort,
  current,
  onSort,
}: {
  label: string;
  sort: ModelSort;
  current: ModelSort;
  onSort: (sort: ModelSort) => void;
}) {
  const isActive = sort === current;
  return (
    <button
      type="button"
      className={`${styles.column} ${isActive ? styles.columnActive : ''}`}
      aria-pressed={isActive}
      onClick={() => onSort(sort)}
    >
      {label}
      {isActive && <span aria-hidden="true">{sort === 'name' ? ' ↑' : ' ↓'}</span>}
    </button>
  );
}

function FilterRail({ graph, colorIndex, filters, onChange, resetFilters, onHelp }: Props) {
  const set = (patch: Partial<Filters>) => onChange((prev) => ({ ...prev, ...patch }));
  const toggleIndex = (key: 'models' | 'fields', value: number) =>
    onChange((prev) => ({ ...prev, [key]: toggled(prev[key], value) }));
  const toggleStatus = (value: NodeStatus) =>
    onChange((prev) => ({ ...prev, statuses: toggled(prev.statuses, value) }));

  const [sort, setSort] = useState<ModelSort>(readSort);
  const [query, setQuery] = useState('');
  const [showsAll, setShowsAll] = useState(false);
  const hasListControls = graph.models.length > MODEL_ROWS;
  const modelOrder = useMemo(
    () => orderModels(graph.models, sort, hasListControls ? query : ''),
    [graph, sort, query, hasListControls],
  );
  // Collapsed: the first rows plus every enabled model further down, so a
  // filter that is on never hides behind "Show all".
  const collapsed = useMemo(
    () => modelOrder.filter((m, i) => i < MODEL_ROWS || filters.models.has(m)),
    [modelOrder, filters.models],
  );
  const hiddenCount = modelOrder.length - collapsed.length;
  const canTruncate = !query.trim() && hiddenCount > MODEL_ROWS_SLACK;
  const isTruncated = canTruncate && !showsAll;
  const shownModels = isTruncated ? collapsed : modelOrder;
  const changeSort = (next: ModelSort) => {
    setSort(next);
    try {
      localStorage.setItem(SORT_KEY, next);
    } catch {
      // Private mode or blocked storage: the choice just lasts for this page.
    }
  };
  const onSearchKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    // Keep the workspace Escape and shortcuts out of the input.
    event.stopPropagation();
    if (event.key === 'Escape') setQuery('');
  };
  const statusCounts = useMemo(() => {
    const counts: Record<NodeStatus, number> = { published: 0, updated: 0, draft: 0 };
    for (const n of graph.nodes) counts[n.status] += 1;
    return counts;
  }, [graph]);
  const [fieldQuery, setFieldQuery] = useState('');
  const [fieldsCollapsed, setFieldsCollapsed] = useState(false);
  const { counts: fieldCounts, targets: fieldTargets } = useMemo(() => fieldStats(graph), [graph]);
  // Fields of the enabled models, grouped by model in the models list's order;
  // with relations outside the selection shown (both or in), also the fields of
  // other models that link into it, in groups marked `isOutside`.
  const fieldGroups = useMemo(() => {
    const showsIncoming = filters.showsOutside && filters.direction !== 'out';
    const byModel = new Map<number, number[]>();
    graph.fields.forEach((f, i) => {
      const isListed =
        filters.models.has(f.model) ||
        (showsIncoming && linksInto(fieldTargets[i], filters.models));
      if (!isListed) return;
      byModel.set(f.model, [...(byModel.get(f.model) ?? []), i]);
    });
    const byRelations = (a: number, b: number) =>
      fieldCounts[b] - fieldCounts[a] ||
      graph.fields[a].label.localeCompare(graph.fields[b].label);
    const groups = orderModels(graph.models, sort, '')
      .filter((m) => byModel.has(m))
      .map((model) => ({
        model,
        isOutside: !filters.models.has(model),
        fields: byModel.get(model)!.sort(byRelations),
      }));
    return [...groups.filter((g) => !g.isOutside), ...groups.filter((g) => g.isOutside)];
  }, [graph, filters.models, filters.showsOutside, filters.direction, sort, fieldCounts, fieldTargets]);
  const hasFieldSearch = fieldGroups.reduce((n, g) => n + g.fields.length, 0) > FIELD_SEARCH_MIN;
  const listedGroups = useMemo(() => {
    const needle = normalizeForSearch(hasFieldSearch ? fieldQuery.trim() : '');
    if (!needle) return fieldGroups;
    return fieldGroups
      .map(({ model, isOutside, fields }) => ({
        model,
        isOutside,
        fields: fields.filter((i) =>
          [graph.fields[i].label, graph.fields[i].apiKey, graph.models[model].name].some((text) =>
            normalizeForSearch(text).includes(needle),
          ),
        ),
      }))
      .filter((g) => g.fields.length > 0);
  }, [graph, fieldGroups, fieldQuery, hasFieldSearch]);
  const listedFields = listedGroups.flatMap((g) => g.fields);
  // Target model names without their leading emoji, as the hint is small.
  const targetNames = (targets: ReadonlySet<number>) =>
    [...targets].map((m) => withoutLeadingSymbols(graph.models[m].name)).sort();
  const onFieldSearchKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    event.stopPropagation();
    if (event.key === 'Escape') setFieldQuery('');
  };

  return (
    <aside className={styles.rail}>
      <section className={styles.section}>
        <GroupHeader
          title="Models"
          onAll={() => set({ models: allFilters(graph).models })}
          onNone={() => set({ models: new Set() })}
        />
        {hasListControls && (
          <>
            <TextInput
              id="grafo-model-search"
              name="grafo-model-search"
              placeholder="Search models"
              aria-label="Search models"
              value={query}
              onChange={setQuery}
              onKeyDown={onSearchKeyDown}
            />
          </>
        )}
        <div className={styles.models}>
          {hasListControls && (
            <div className={styles.columns}>
              <SortHeader label="Model" sort="name" current={sort} onSort={changeSort} />
              <SortHeader label="Records" sort="count" current={sort} onSort={changeSort} />
            </div>
          )}
          {modelOrder.length === 0 && <p className={styles.empty}>No models match</p>}
          {shownModels.map((m) => {
            const isOn = filters.models.has(m);
            return (
              <div
                key={m}
                className={`${styles.model} ${isOn ? styles.on : styles.off}`}
                role="button"
                tabIndex={0}
                aria-pressed={isOn}
                onClick={() => toggleIndex('models', m)}
                onDoubleClick={() => set({ models: new Set([m]) })}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    toggleIndex('models', m);
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
        {canTruncate && (
          <Button buttonType="muted" buttonSize="xxs" onClick={() => setShowsAll(isTruncated)}>
            {isTruncated ? `Show all (${modelOrder.length})` : 'Show fewer'}
          </Button>
        )}
      </section>

      <section className={styles.section}>
        <GroupHeader
          title="Status"
          onAll={() => set({ statuses: allFilters(graph).statuses })}
          onNone={() => set({ statuses: new Set() })}
        />
        <div className={styles.chips}>
          {NODE_STATUSES.map((status) => (
            <button
              key={status}
              type="button"
              className={`${styles.chip} ${filters.statuses.has(status) ? styles.on : styles.chipOff}`}
              title={`${statusCounts[status]} records`}
              aria-pressed={filters.statuses.has(status)}
              onClick={() => toggleStatus(status)}
            >
              {STATUS_LABEL[status]}
            </button>
          ))}
        </div>
      </section>

      <section className={styles.section}>
        <GroupHeader
          title="Relation fields"
          isCollapsed={fieldsCollapsed}
          onToggleCollapse={() => setFieldsCollapsed((c) => !c)}
          onAll={() =>
            set({ fields: new Set([...filters.fields, ...listedFields]) })
          }
          onNone={() => {
            const listed = new Set(listedFields);
            set({ fields: new Set([...filters.fields].filter((i) => !listed.has(i))) });
          }}
        />
        {!fieldsCollapsed && hasFieldSearch && (
          <TextInput
            id="grafo-field-search"
            name="grafo-field-search"
            placeholder="Search fields"
            aria-label="Search fields"
            value={fieldQuery}
            onChange={setFieldQuery}
            onKeyDown={onFieldSearchKeyDown}
          />
        )}
        {!fieldsCollapsed && listedGroups.length === 0 && (
          <p className={styles.empty}>
            {fieldGroups.length === 0
              ? 'No relation fields for the selected models'
              : 'No fields match'}
          </p>
        )}
        {!fieldsCollapsed &&
          listedGroups.map(({ model, isOutside, fields }, i) => (
            <div key={model} className={styles.fieldGroup}>
              {isOutside && !listedGroups[i - 1]?.isOutside && (
                <p className={styles.outsideLabel}>Outside selection</p>
              )}
              <div className={`${styles.groupLabel} ${isOutside ? styles.groupOutside : ''}`}>
                <span className={styles.dot} style={{ background: modelColor(colorIndex[model]) }} />
                <span className={styles.modelName}>{graph.models[model].name}</span>
              </div>
              <div className={styles.chips}>
                {fields.map((index) => {
                  const field = graph.fields[index];
                  const isOn = filters.fields.has(index);
                  const targets = targetNames(fieldTargets[index]);
                  return (
                    <button
                      key={index}
                      type="button"
                      className={`${styles.chip} ${isOn ? styles.on : styles.chipOff}`}
                      title={`${fieldTitle(field, graph)} → ${targets.join(', ')} · ${field.apiKey} · ${fieldCounts[index]} relations`}
                      aria-pressed={isOn}
                      onClick={() => toggleIndex('fields', index)}
                    >
                      {fieldLabel(field)}
                      <span className={styles.chipTarget}>
                        {' → '}
                        {targets.length === 1 ? targets[0] : `${targets.length} models`}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
      </section>

      <section className={styles.section}>
        <SwitchField
          id="grafo-outside"
          name="grafo-outside"
          label="Relations outside selection"
          value={filters.showsOutside}
          onChange={(showsOutside) => set({ showsOutside })}
          hint={
            filters.showsOutside && filters.models.size === graph.models.length
              ? 'All models are selected: nothing is outside the selection.'
              : undefined
          }
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

      <div className={styles.actions}>
        <Button buttonType="muted" buttonSize="s" onClick={() => onChange(() => resetFilters())}>
          Reset filters
        </Button>
        <Button buttonType="muted" buttonSize="s" onClick={onHelp}>
          Help
        </Button>
      </div>
    </aside>
  );
}

export default memo(FilterRail);
