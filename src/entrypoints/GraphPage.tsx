import type { RenderPageCtx } from 'datocms-plugin-sdk';
import { Canvas, Spinner } from 'datocms-react-ui';
import type { ReactNode } from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';
import GraphWorkspace from '../components/GraphWorkspace';
import { loadGraph, loadGraphKey } from '../data/loadGraph';
import type { Graph } from '../data/types';
import styles from './GraphPage.module.css';

type State =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'done'; graph: Graph; requestCount: number };

const graphKeys = new WeakMap<Graph, number>();
let lastGraphKey = 0;
function graphKey(graph: Graph): number {
  let key = graphKeys.get(graph);
  if (key === undefined) {
    lastGraphKey += 1;
    key = lastGraphKey;
    graphKeys.set(graph, key);
  }
  return key;
}

export default function GraphPage({ ctx }: { ctx: RenderPageCtx }) {
  const apiToken = ctx.currentUserAccessToken;
  const { environment, cmaBaseUrl: baseUrl } = ctx;
  const permissions = ctx.currentRole.meta.final_permissions;
  const [state, setState] = useState<State>({ status: 'loading' });

  // A new ctx brings a new permissions object with the same content: the effect
  // depends on its string key, and reads the object through a ref.
  const loadKey = useMemo(
    () => loadGraphKey(environment, baseUrl, permissions),
    [environment, baseUrl, permissions],
  );
  const permissionsRef = useRef(permissions);
  useEffect(() => {
    permissionsRef.current = permissions;
  }, [permissions]);

  useEffect(() => {
    if (!apiToken) return;
    let cancelled = false;
    setState({ status: 'loading' });
    loadGraph({ apiToken, environment, baseUrl, permissions: permissionsRef.current })
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
  }, [apiToken, environment, baseUrl, loadKey]);

  const graph = state.status === 'done' ? state.graph : null;

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
  } else if (graph) {
    return (
      <Canvas ctx={ctx} noAutoResizer>
        <GraphWorkspace
          key={graphKey(graph)}
          graph={graph}
          requestCount={state.requestCount}
          ctx={ctx}
        />
      </Canvas>
    );
  }

  return (
    <Canvas ctx={ctx} noAutoResizer>
      <div className={styles.page}>
        <h1 className={styles.title}>Grafo</h1>
        {body}
      </div>
    </Canvas>
  );
}
