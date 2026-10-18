import type { RenderPageCtx } from 'datocms-plugin-sdk';
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { expandAround } from '../data/expandAround';
import { filterGraph, type Filters } from '../data/filterGraph';
import { startingFilters } from '../data/startingFilters';
import { deserializeFilters, serializeFilters, startingKeyOf } from '../data/storedFilters';
import { reconcileFilters, reconcileSelection } from '../data/reconcileView';
import { nodeIndexById } from '../data/relationsOf';
import type { Graph } from '../data/types';
import { autoDistance } from '../graph/autoDistance';
import { recordEditPath } from '../graph/recordEditPath';
import { searchTitles } from '../data/searchTitles';
import type { LabelMode } from '../graph/renderGraph';
import { prepareSimulation } from '../graph/prepareSimulation';
import CanvasControls from './CanvasControls';
import FilterRail from './FilterRail';
import GraphView, { type GraphViewHandle } from './GraphView';
import Inspector from './Inspector';
import { createCreatorResolver } from './creatorName';
import styles from './GraphWorkspace.module.css';

interface Props {
  graph: Graph;
  requestCount: number;
  isRefreshing: boolean;
  refreshError: string | null;
  onReload: () => void;
  startingModelApiKeys: string[];
  /** localStorage key for this site, environment and user; null disables remembering. */
  storageKey: string | null;
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
  storageKey,
  ctx,
}: Props) {
  const [storedFilters, setFilters] = useState(() => {
    const startingKey = startingKeyOf(startingModelApiKeys);
    try {
      const raw = storageKey === null ? null : window.localStorage.getItem(storageKey);
      if (raw !== null) {
        const restored = deserializeFilters(graph, JSON.parse(raw), startingKey);
        if (restored) return restored;
      }
    } catch {
      // Blocked or partitioned storage, or unparsable JSON: start from the configured models.
    }
    return startingFilters(graph, startingModelApiKeys);
  });
  const startingKeysRef = useRef(startingModelApiKeys);
  useEffect(() => {
    startingKeysRef.current = startingModelApiKeys;
  }, [startingModelApiKeys]);
  // A refreshed graph re-indexes models and fields: remap the filters in this
  // same render, so `filterGraph` never pairs the new graph with old indexes.
  const [prevGraph, setPrevGraph] = useState(graph);
  const { filters, isRemap } = reconcileFilters(prevGraph, graph, storedFilters);
  if (isRemap) {
    setPrevGraph(graph);
    setFilters(filters);
  }
  // Remember the filters. At the starting filters the key is removed instead,
  // so "Reset filters" forgets what was stored and a plain visit stores nothing.
  useEffect(() => {
    if (storageKey === null) return;
    try {
      const startingKey = startingKeyOf(startingKeysRef.current);
      const json = JSON.stringify(serializeFilters(graph, filters, startingKey));
      const atStart = JSON.stringify(
        serializeFilters(graph, startingFilters(graph, startingKeysRef.current), startingKey),
      );
      if (json === atStart) window.localStorage.removeItem(storageKey);
      else window.localStorage.setItem(storageKey, json);
    } catch {
      // Blocked storage: filters just aren't remembered.
    }
  }, [graph, filters, storageKey]);
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
  // The remap after a Reload is not a user change: the selection stays while
  // its record is still in the graph, and the expansion recomputes around it.
  const [prevFilters, setPrevFilters] = useState(filters);
  let checkedSelectedId = rawSelectedId;
  if (filters !== prevFilters) {
    setPrevFilters(filters);
    checkedSelectedId = reconcileSelection(rawSelectedId, true, isRemap, filtered);
    if (checkedSelectedId !== rawSelectedId) setSelectedId(checkedSelectedId);
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

  // Stage side for the automatic distance, at most once per animation frame.
  // Measured before paint, and the graph mounts only then, so the first
  // layout already runs at the automatic distance (1100 if the stage has no size).
  const stageRef = useRef<HTMLDivElement>(null);
  const [canvasSide, setCanvasSide] = useState<number | null>(null);
  useLayoutEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    let frame: number | null = null;
    const measure = () => {
      frame = null;
      const side = Math.min(stage.clientWidth, stage.clientHeight);
      setCanvasSide((prev) => (side > 0 ? side : (prev ?? 1100)));
    };
    measure();
    const observer = new ResizeObserver(() => {
      if (frame === null) frame = requestAnimationFrame(measure);
    });
    observer.observe(stage);
    return () => {
      observer.disconnect();
      if (frame !== null) cancelAnimationFrame(frame);
    };
  }, []);
  // Auto (default) follows the visible node count and the stage size; the
  // slider switches to manual. A selection's expansion must not move the
  // layout under the focus: while something is selected the automatic value
  // stays at its last unselected one, and recomputes on deselect.
  const [distanceMode, setDistanceMode] = useState<'auto' | 'manual'>('auto');
  const [manualDistance, setManualDistance] = useState(1.6);
  const liveAuto = autoDistance(visibleIds.size, canvasSide ?? 1100);
  const [heldAuto, setHeldAuto] = useState(liveAuto);
  if (selectedId === null && heldAuto !== liveAuto) setHeldAuto(liveAuto);
  const autoValue = selectedId === null ? liveAuto : heldAuto;
  const distance = distanceMode === 'auto' ? autoValue : manualDistance;
  const changeDistance = useCallback((d: number) => {
    setDistanceMode('manual');
    setManualDistance(d);
  }, []);
  const toggleAutoDistance = useCallback(() => {
    if (distanceMode === 'auto') {
      // Keeps the current value: nothing moves until the slider does.
      setManualDistance(autoValue);
      setDistanceMode('manual');
    } else {
      setDistanceMode('auto');
    }
  }, [distanceMode, autoValue]);

  // Every filter change (Reset included) centres the resulting view, even
  // after a user zoom; selection changes keep their own focus behaviour.
  const changeFilters = useCallback((update: (prev: Filters) => Filters) => {
    viewRef.current?.reframe();
    setFilters(update);
  }, []);

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
  const resetFilters = useCallback(
    () => startingFilters(graph, startingKeysRef.current),
    [graph],
  );
  const openHelp = useCallback(() => {
    void ctxRef.current.openModal({ id: 'help', title: 'Grafo help', width: 'm', initialHeight: 480 });
  }, []);
  const reload = useCallback(() => {
    if (reloadStartedRef.current) return;
    reloadStartedRef.current = true;
    onReload();
  }, [onReload]);

  const [query, setQuery] = useState('');
  const [labelMode, setLabelMode] = useState<LabelMode>('smart');
  const resolveCreatorName = useMemo(
    () => createCreatorResolver(() => ctxRef.current),
    [],
  );
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
    ` · ${visible.edgeIndexes.length} relations · ${requestCount} API ${requestCount === 1 ? 'call' : 'calls'}` +
    (isRefreshing ? ' · Reloading…' : refreshError ? ` · Reload failed: ${refreshError}` : '');

  return (
    <div className={styles.workspace}>
      <FilterRail
        graph={graph}
        colorIndex={data.colorIndex}
        filters={filters}
        onChange={changeFilters}
        resetFilters={resetFilters}
        onHelp={openHelp}
      />
      <div ref={stageRef} className={styles.stage}>
        {canvasSide !== null && (
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
        )}
        <CanvasControls
          query={query}
          onQueryChange={setQuery}
          onSearchEnter={jumpToFirstMatch}
          matchCount={matches.length}
          labelMode={labelMode}
          onLabelModeChange={setLabelMode}
          distance={distance}
          onDistanceChange={changeDistance}
          isAutoDistance={distanceMode === 'auto'}
          onAutoDistanceToggle={toggleAutoDistance}
          onZoomIn={() => viewRef.current?.zoomBy(1.35)}
          onZoomOut={() => viewRef.current?.zoomBy(1 / 1.35)}
          onFit={() => viewRef.current?.fit()}
          onRelayout={() => viewRef.current?.relayout()}
          stats={stats}
          statsTitle="Content Management API calls for the last load, retries included"
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
        locale={ctx.ui.locale}
        resolveCreatorName={resolveCreatorName}
      />
    </div>
  );
}
