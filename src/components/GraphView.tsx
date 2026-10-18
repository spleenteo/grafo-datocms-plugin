import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import {
  renderGraph,
  type LabelMode,
  type Point,
  type RenderGraphHandle,
  type ViewState,
} from '../graph/renderGraph';
import type { VisibleSet } from '../data/filterGraph';
import type { prepareSimulation } from '../graph/prepareSimulation';
import styles from './GraphView.module.css';

interface Props {
  data: ReturnType<typeof prepareSimulation>;
  visible: VisibleSet;
  selectedId: string | null;
  labelMode: LabelMode;
  matchIds: ReadonlySet<string>;
  distance: number;
  modelName: (model: number) => string;
  onSelect: (id: string | null) => void;
}

export interface GraphViewHandle {
  focusOn(id: string): void;
  zoomBy(factor: number): void;
  fit(): void;
  relayout(): void;
  reframe(): void;
  holdView(): void;
}

const GraphView = forwardRef<GraphViewHandle, Props>(function GraphView(
  { data, visible, selectedId, labelMode, matchIds, distance, modelName, onSelect },
  ref,
) {
  const svgRef = useRef<SVGSVGElement>(null);
  // Read through refs so a new callback or value never re-mounts the SVG.
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;
  const handleRef = useRef<RenderGraphHandle | null>(null);
  const visibleRef = useRef(visible);
  visibleRef.current = visible;
  const selectedIdRef = useRef(selectedId);
  selectedIdRef.current = selectedId;

  const labelModeRef = useRef(labelMode);
  labelModeRef.current = labelMode;
  const matchIdsRef = useRef(matchIds);
  matchIdsRef.current = matchIds;
  const distanceRef = useRef(distance);
  distanceRef.current = distance;
  // Filled by the mount effect's cleanup: the next mount (new data after a
  // refresh) starts where the old one left off.
  const seedRef = useRef<{ positions: Map<string, Point>; view: ViewState } | null>(null);

  useImperativeHandle(
    ref,
    () => ({
      focusOn: (id) => handleRef.current?.focusOn(id),
      zoomBy: (factor) => handleRef.current?.zoomBy(factor),
      fit: () => handleRef.current?.fit(),
      relayout: () => handleRef.current?.relayout(),
      reframe: () => handleRef.current?.reframe(),
      holdView: () => handleRef.current?.holdView(),
    }),
    [],
  );

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const seed = seedRef.current;
    seedRef.current = null;
    const handle = renderGraph(svg, data, {
      initialPositions: seed?.positions,
      initialTransform: seed?.view.transform,
      initialUserMoved: seed?.view.userMoved,
      modelName,
      onSelect: (id) => onSelectRef.current(id),
      initialVisible: visibleRef.current,
      labelMode: labelModeRef.current,
      distance: distanceRef.current,
      matchIds: matchIdsRef.current,
    });
    handleRef.current = handle;
    // A fresh renderer starts with nothing selected.
    handle.setSelection(selectedIdRef.current);
    // A no-op unless the visible set changed since the mount read it.
    handle.update(visibleRef.current);
    return () => {
      // Read before destroy(), which stops the simulation and clears the SVG.
      seedRef.current = { positions: handle.positions(), view: handle.viewState() };
      handle.destroy();
      handleRef.current = null;
    };
  }, [data, modelName]);

  // Selection before update: the update seeds entering nodes at the new
  // selection, and a deselect clears the focus before the collapse settles.
  useEffect(() => {
    handleRef.current?.setSelection(selectedId);
  }, [selectedId]);

  useEffect(() => {
    handleRef.current?.update(visible);
  }, [visible]);

  useEffect(() => {
    handleRef.current?.setLabelMode(labelMode);
  }, [labelMode]);

  useEffect(() => {
    handleRef.current?.setQuery(matchIds);
  }, [matchIds]);

  useEffect(() => {
    handleRef.current?.setDistance(distance);
  }, [distance]);

  return <svg ref={svgRef} className={styles.svg} />;
});

export default GraphView;
