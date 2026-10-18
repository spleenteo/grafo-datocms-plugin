import type { RenderPageCtx } from 'datocms-plugin-sdk';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { allFilters, filterGraph } from '../data/filterGraph';
import { nodeIndexById } from '../data/relationsOf';
import type { Graph } from '../data/types';
import { recordEditPath } from '../graph/recordEditPath';
import { prepareSimulation } from '../graph/prepareSimulation';
import FilterRail from './FilterRail';
import GraphView, { type GraphViewHandle } from './GraphView';
import Inspector from './Inspector';
import styles from './GraphWorkspace.module.css';

interface Props {
  graph: Graph;
  requestCount: number;
  ctx: RenderPageCtx;
}

function isTextEntry(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return (
    target.isContentEditable ||
    ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)
  );
}

export default function GraphWorkspace({ graph, requestCount, ctx }: Props) {
  const [filters, setFilters] = useState(() => allFilters(graph));
  const data = useMemo(() => prepareSimulation(graph), [graph]);
  const visible = useMemo(() => filterGraph(graph, filters), [graph, filters]);
  const modelName = useCallback(
    (model: number) => graph.models[model]?.name ?? '',
    [graph],
  );

  const [rawSelectedId, setSelectedId] = useState<string | null>(null);
  const viewRef = useRef<GraphViewHandle>(null);
  const ctxRef = useRef(ctx);
  ctxRef.current = ctx;
  const indexById = useMemo(() => nodeIndexById(graph), [graph]);
  const visibleIds = useMemo(
    () => new Set([...visible.coreIds, ...visible.contextIds]),
    [visible],
  );
  // A selection that left the visible set (or the graph) counts as none.
  const selectedId =
    rawSelectedId !== null && visibleIds.has(rawSelectedId) ? rawSelectedId : null;
  const selectedIdRef = useRef(selectedId);
  selectedIdRef.current = selectedId;

  useEffect(() => {
    if (rawSelectedId !== null && selectedId === null) setSelectedId(null);
  }, [rawSelectedId, selectedId]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || selectedIdRef.current === null) return;
      if (isTextEntry(e.target)) return;
      setSelectedId(null);
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, []);

  const openNode = useCallback(
    (index: number) => {
      const node = graph.nodes[index];
      const { isEnvironmentPrimary, environment, navigateTo } = ctxRef.current;
      navigateTo(
        recordEditPath({
          isEnvironmentPrimary,
          environment,
          itemTypeId: node.itemTypeId,
          itemId: node.id,
        }),
      );
    },
    [graph],
  );
  const selectFromInspector = useCallback((id: string) => {
    setSelectedId(id);
    viewRef.current?.focusOn(id);
  }, []);

  const contextCount = visible.contextIds.size;
  const isEverythingSelected = filters.models.size === graph.models.length;

  return (
    <div className={styles.workspace}>
      <FilterRail
        graph={graph}
        colorIndex={data.colorIndex}
        filters={filters}
        onChange={setFilters}
      />
      <div className={styles.stage}>
        <GraphView
          ref={viewRef}
          data={data}
          visible={visible}
          selectedId={selectedId}
          modelName={modelName}
          onSelect={setSelectedId}
        />
        <div className={styles.overlay}>
          <p className={styles.counts}>
            {visible.coreIds.size} of {graph.nodes.length} records
            {contextCount > 0 && ` (+${contextCount} related)`}
            {` · ${visible.edgeIndexes.length} relations · ${requestCount} CMA requests`}
          </p>
          {filters.showsOutside && isEverythingSelected && (
            <p className={styles.hint}>
              All models are selected: nothing is outside the selection.
            </p>
          )}
        </div>
      </div>
      <Inspector
        graph={graph}
        nodeIndex={selectedId === null ? null : (indexById.get(selectedId) ?? null)}
        visibleIds={visibleIds}
        colorIndex={data.colorIndex}
        onSelectNode={selectFromInspector}
        onOpenNode={openNode}
        onClose={() => setSelectedId(null)}
      />
    </div>
  );
}
