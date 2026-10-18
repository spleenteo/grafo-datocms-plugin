import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import { renderGraph, type RenderGraphHandle } from '../graph/renderGraph';
import type { VisibleSet } from '../data/filterGraph';
import type { prepareSimulation } from '../graph/prepareSimulation';
import styles from './GraphView.module.css';

interface Props {
  data: ReturnType<typeof prepareSimulation>;
  visible: VisibleSet;
  selectedId: string | null;
  modelName: (model: number) => string;
  onSelect: (id: string | null) => void;
}

export interface GraphViewHandle {
  focusOn(id: string): void;
}

const GraphView = forwardRef<GraphViewHandle, Props>(function GraphView(
  { data, visible, selectedId, modelName, onSelect },
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

  useImperativeHandle(ref, () => ({ focusOn: (id) => handleRef.current?.focusOn(id) }), []);

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const handle = renderGraph(svg, data, {
      modelName,
      onSelect: (id) => onSelectRef.current(id),
      initialVisible: visibleRef.current,
    });
    handleRef.current = handle;
    // A no-op unless the visible set changed since the mount read it.
    handle.update(visibleRef.current);
    // A fresh renderer starts with nothing selected.
    handle.setSelection(selectedIdRef.current);
    return () => {
      handle.destroy();
      handleRef.current = null;
    };
  }, [data, modelName]);

  useEffect(() => {
    handleRef.current?.update(visible);
  }, [visible]);

  useEffect(() => {
    handleRef.current?.setSelection(selectedId);
  }, [selectedId, visible]);

  return <svg ref={svgRef} className={styles.svg} />;
});

export default GraphView;
