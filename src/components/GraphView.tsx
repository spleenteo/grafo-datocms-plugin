import type { RenderPageCtx } from 'datocms-plugin-sdk';
import { useEffect, useRef } from 'react';
import { recordEditPath } from '../graph/recordEditPath';
import { renderGraph } from '../graph/renderGraph';
import type { prepareSimulation } from '../graph/prepareSimulation';
import styles from './GraphView.module.css';

interface Props {
  data: ReturnType<typeof prepareSimulation>;
  modelName: (model: number) => string;
  ctx: RenderPageCtx;
}

export default function GraphView({ data, modelName, ctx }: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  const ctxRef = useRef(ctx);
  ctxRef.current = ctx;

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const { destroy } = renderGraph(svg, data, {
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
    return destroy;
  }, [data, modelName]);

  return <svg ref={svgRef} className={styles.svg} />;
}
