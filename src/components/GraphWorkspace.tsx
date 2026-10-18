import type { RenderPageCtx } from 'datocms-plugin-sdk';
import { useCallback, useMemo, useState } from 'react';
import { allFilters, filterGraph } from '../data/filterGraph';
import type { Graph } from '../data/types';
import { prepareSimulation } from '../graph/prepareSimulation';
import FilterRail from './FilterRail';
import GraphView from './GraphView';
import styles from './GraphWorkspace.module.css';

interface Props {
  graph: Graph;
  requestCount: number;
  ctx: RenderPageCtx;
}

export default function GraphWorkspace({ graph, requestCount, ctx }: Props) {
  const [filters, setFilters] = useState(() => allFilters(graph));
  const data = useMemo(() => prepareSimulation(graph), [graph]);
  const visible = useMemo(() => filterGraph(graph, filters), [graph, filters]);
  const modelName = useCallback(
    (model: number) => graph.models[model]?.name ?? '',
    [graph],
  );

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
        <GraphView data={data} visible={visible} modelName={modelName} ctx={ctx} />
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
    </div>
  );
}
