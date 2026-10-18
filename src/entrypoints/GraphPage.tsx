import type { RenderPageCtx } from 'datocms-plugin-sdk';
import { Canvas, Spinner } from 'datocms-react-ui';
import type { ReactNode } from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import GraphView from '../components/GraphView';
import { prepareSimulation } from '../graph/prepareSimulation';
import { loadGraph } from '../data/loadGraph';
import type { Graph } from '../data/types';
import styles from './GraphPage.module.css';

type State =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'done'; graph: Graph; requestCount: number };

export default function GraphPage({ ctx }: { ctx: RenderPageCtx }) {
  const apiToken = ctx.currentUserAccessToken;
  const { environment, cmaBaseUrl: baseUrl } = ctx;
  const [state, setState] = useState<State>({ status: 'loading' });

  useEffect(() => {
    if (!apiToken) return;
    let cancelled = false;
    setState({ status: 'loading' });
    loadGraph({ apiToken, environment, baseUrl })
      .then(({ graph, requestCount }) => {
        if (!cancelled) setState({ status: 'done', graph, requestCount });
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setState({
            status: 'error',
            message: error instanceof Error ? error.message : String(error),
          });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [apiToken, environment, baseUrl]);

  const graph = state.status === 'done' ? state.graph : null;
  const data = useMemo(() => (graph ? prepareSimulation(graph) : null), [graph]);
  const modelName = useCallback(
    (model: number) => graph?.models[model]?.name ?? '',
    [graph],
  );

  let body: ReactNode;
  if (!apiToken) {
    body = (
      <p className={styles.error}>
        Grant the currentUserAccessToken permission in the plugin settings.
      </p>
    );
  } else if (state.status === 'loading') {
    body = <Spinner placement="centered" />;
  } else if (state.status === 'error') {
    body = <p className={styles.error}>{state.message}</p>;
  } else {
    body = null;
  }

  const done = state.status === 'done' && apiToken && data;
  if (done) {
    return (
      <Canvas ctx={ctx} noAutoResizer>
        <div className={styles.fullPage}>
          <h1 className={styles.title}>Content Graph</h1>
          <div className={styles.stage}>
            <GraphView data={data} modelName={modelName} ctx={ctx} />
            <p className={styles.overlay}>
              {state.graph.nodes.length} records · {state.graph.models.length}{' '}
              models · {data.links.length} relations · {state.requestCount} CMA
              requests
            </p>
          </div>
        </div>
      </Canvas>
    );
  }

  return (
    <Canvas ctx={ctx} noAutoResizer>
      <div className={styles.page}>
        <h1 className={styles.title}>Content Graph</h1>
        {body}
      </div>
    </Canvas>
  );
}
