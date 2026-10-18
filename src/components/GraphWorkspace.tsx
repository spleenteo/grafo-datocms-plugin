import type { RenderPageCtx } from 'datocms-plugin-sdk';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { expandAround } from '../data/expandAround';
import { filterGraph } from '../data/filterGraph';
import { startingFilters } from '../data/startingFilters';
import { remapFilters } from '../data/remapFilters';
import { nodeIndexById } from '../data/relationsOf';
import type { Graph } from '../data/types';
import { recordEditPath } from '../graph/recordEditPath';
import { searchTitles } from '../data/searchTitles';
import type { LabelMode } from '../graph/renderGraph';
import { prepareSimulation } from '../graph/prepareSimulation';
import CanvasControls from './CanvasControls';
import FilterRail from './FilterRail';
import GraphView, { type GraphViewHandle } from './GraphView';
import Inspector from './Inspector';
import styles from './GraphWorkspace.module.css';

interface Props {
  graph: Graph;
  requestCount: number;
  isRefreshing: boolean;
  refreshError: string | null;
  onReload: () => void;
  startingModelApiKeys: string[];
  ctx: RenderPageCtx;
}

function isTextEntry(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return (
    target.isContentEditable ||
    ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)
  );
}

export default function GraphWorkspace({
  graph,
  requestCount,
  isRefreshing,
  refreshError,
  onReload,
  startingModelApiKeys,
  ctx,
}: Props) {
  const [storedFilters, setFilters] = useState(() => startingFilters(graph, startingModelApiKeys));
  const startingKeysRef = useRef(startingModelApiKeys);
  useEffect(() => {
    startingKeysRef.current = startingModelApiKeys;
  }, [startingModelApiKeys]);
  // A refreshed graph re-indexes models and fields: remap the filters in this
  // same render, so `filterGraph` never pairs the new graph with old indexes.
  const [prevGraph, setPrevGraph] = useState(graph);
  let filters = storedFilters;
  if (graph !== prevGraph) {
    filters = remapFilters(prevGraph, graph, storedFilters);
    setPrevGraph(graph);
    setFilters(filters);
  }
  const data = useMemo(() => prepareSimulation(graph), [graph]);
  const filtered = useMemo(() => filterGraph(graph, filters), [graph, filters]);
  const modelName = useCallback(
    (model: number) => graph.models[model]?.name ?? '',
    [graph],
  );

  const [rawSelectedId, setSelectedId] = useState<string | null>(null);
  const viewRef = useRef<GraphViewHandle>(null);
  const ctxRef = useRef(ctx);
  ctxRef.current = ctx;
  const indexById = useMemo(() => nodeIndexById(graph), [graph]);
  // A selection may sit on an expansion node (the user walks from record to
  // record), so it is checked against the filtered set only when the filters
  // change: in this same render, so no frame expands around a stale selection.
  const [prevFilters, setPrevFilters] = useState(filters);
  let checkedSelectedId = rawSelectedId;
  if (filters !== prevFilters) {
    setPrevFilters(filters);
    if (
      checkedSelectedId !== null &&
      !filtered.coreIds.has(checkedSelectedId) &&
      !filtered.contextIds.has(checkedSelectedId)
    ) {
      checkedSelectedId = null;
      setSelectedId(null);
    }
  }
  // A selection that left the graph (after a reload) counts as none.
  const selectedIndex =
    checkedSelectedId === null ? undefined : indexById.get(checkedSelectedId);
  const selectedId = selectedIndex === undefined ? null : checkedSelectedId;
  // The selected record's own relations join the view; deselect collapses them.
  const visible = useMemo(
    () =>
      selectedIndex === undefined
        ? filtered
        : expandAround(graph, filtered, selectedIndex, filters),
    [graph, filtered, selectedIndex, filters],
  );
  const visibleIds = useMemo(
    () => new Set([...visible.coreIds, ...visible.contextIds]),
    [visible],
  );
  const selectedIdRef = useRef(selectedId);
  selectedIdRef.current = selectedId;

  useEffect(() => {
    if (rawSelectedId !== null && selectedId === null) setSelectedId(null);
  }, [rawSelectedId, selectedId]);

  // Every user selection (node click, Enter/Space, search Enter, inspector
  // row) goes through here; null (background click, Esc, close) deselects,
  // and the collapse that follows keeps the camera where it is.
  const selectNode = useCallback((id: string | null) => {
    if (id === null) viewRef.current?.holdView();
    else viewRef.current?.focusOn(id);
    setSelectedId(id);
  }, []);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || selectedIdRef.current === null) return;
      if (isTextEntry(e.target)) return;
      selectNode(null);
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [selectNode]);

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
  // Set synchronously on click so a fast double click starts one refresh.
  const reloadStartedRef = useRef(false);
  useEffect(() => {
    if (!isRefreshing) reloadStartedRef.current = false;
  }, [isRefreshing]);
  const reload = useCallback(() => {
    if (reloadStartedRef.current) return;
    reloadStartedRef.current = true;
    onReload();
  }, [onReload]);

  const [query, setQuery] = useState('');
  const [labelMode, setLabelMode] = useState<LabelMode>('smart');
  const [distance, setDistance] = useState(1);
  const matches = useMemo(
    () => searchTitles(graph, visibleIds, query),
    [graph, visibleIds, query],
  );
  const matchIds = useMemo(() => new Set(matches), [matches]);
  const jumpToFirstMatch = useCallback(() => {
    const first = matches[0];
    if (first === undefined) return;
    selectNode(first);
  }, [matches, selectNode]);

  const contextCount = visible.contextIds.size;
  const stats =
    `${visible.coreIds.size} of ${graph.nodes.length} records` +
    (contextCount > 0 ? ` (+${contextCount} related)` : '') +
    ` · ${visible.edgeIndexes.length} relations · ${requestCount} CMA requests` +
    (isRefreshing ? ' · Reloading…' : refreshError ? ` · Reload failed: ${refreshError}` : '');

  return (
    <div className={styles.workspace}>
      <FilterRail
        graph={graph}
        colorIndex={data.colorIndex}
        filters={filters}
        onChange={setFilters}
        onReframe={() => viewRef.current?.reframe()}
        resetFilters={() => startingFilters(graph, startingKeysRef.current)}
        onHelp={() =>
          void ctxRef.current.openModal({ id: 'help', title: 'Grafo help', width: 'm', initialHeight: 480 })
        }
      />
      <div className={styles.stage}>
        <GraphView
          ref={viewRef}
          data={data}
          visible={visible}
          selectedId={selectedId}
          labelMode={labelMode}
          matchIds={matchIds}
          distance={distance}
          modelName={modelName}
          onSelect={selectNode}
        />
        <CanvasControls
          query={query}
          onQueryChange={setQuery}
          onSearchEnter={jumpToFirstMatch}
          matchCount={matches.length}
          labelMode={labelMode}
          onLabelModeChange={setLabelMode}
          distance={distance}
          onDistanceChange={setDistance}
          onZoomIn={() => viewRef.current?.zoomBy(1.35)}
          onZoomOut={() => viewRef.current?.zoomBy(1 / 1.35)}
          onFit={() => viewRef.current?.fit()}
          onRelayout={() => viewRef.current?.relayout()}
          stats={stats}
          onReload={reload}
          isReloadDisabled={isRefreshing}
        />
      </div>
      <Inspector
        graph={graph}
        nodeIndex={selectedId === null ? null : (indexById.get(selectedId) ?? null)}
        visibleIds={visibleIds}
        colorIndex={data.colorIndex}
        onSelectNode={selectNode}
        onOpenNode={openNode}
        onClose={() => selectNode(null)}
      />
    </div>
  );
}
