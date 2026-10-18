import { useEffect, useRef } from 'react';
import { renderGraph, type RenderGraphHandle } from '../graph/renderGraph';
import type { VisibleSet } from '../data/filterGraph';
import type { prepareSimulation } from '../graph/prepareSimulation';
import styles from './GraphView.module.css';

interface Props {
  data: ReturnType<typeof prepareSimulation>;
  visible: VisibleSet;
  modelName: (model: number) => string;
  onSelect?: (id: string | null) => void;
}

const noop = () => {};

export default function GraphView({ data, visible, modelName, onSelect = noop }: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  // Read through a ref so a new callback never re-mounts the SVG.
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;
  const handleRef = useRef<RenderGraphHandle | null>(null);
  const visibleRef = useRef(visible);
  visibleRef.current = visible;

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const handle = renderGraph(svg, data, {
      modelName,
      onSelect: (id) => onSelectRef.current(id),
    });
    handleRef.current = handle;
    handle.update(visibleRef.current);
    return () => {
      handle.destroy();
      handleRef.current = null;
    };
  }, [data, modelName]);

  useEffect(() => {
    handleRef.current?.update(visible);
  }, [visible]);

  return <svg ref={svgRef} className={styles.svg} />;
}
