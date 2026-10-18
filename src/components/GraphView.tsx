import type { RenderPageCtx } from 'datocms-plugin-sdk';
import { useEffect, useRef } from 'react';
import { recordEditPath } from '../graph/recordEditPath';
import { renderGraph, type RenderGraphHandle } from '../graph/renderGraph';
import type { VisibleSet } from '../data/filterGraph';
import type { prepareSimulation } from '../graph/prepareSimulation';
import styles from './GraphView.module.css';

interface Props {
  data: ReturnType<typeof prepareSimulation>;
  visible: VisibleSet;
  modelName: (model: number) => string;
  ctx: RenderPageCtx;
}

export default function GraphView({ data, visible, modelName, ctx }: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  const ctxRef = useRef(ctx);
  ctxRef.current = ctx;
  const handleRef = useRef<RenderGraphHandle | null>(null);
  const visibleRef = useRef(visible);
  visibleRef.current = visible;

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const handle = renderGraph(svg, data, {
      modelName,
      onOpen: (node) => {
        const c = ctxRef.current;
        c.navigateTo(
          recordEditPath({
            isEnvironmentPrimary: c.isEnvironmentPrimary,
            environment: c.environment,
            itemTypeId: node.itemTypeId,
            itemId: node.id,
          }),
        );
      },
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
