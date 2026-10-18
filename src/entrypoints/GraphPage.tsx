import type { RenderPageCtx } from 'datocms-plugin-sdk';
import { Canvas, Spinner } from 'datocms-react-ui';
import type { ReactNode } from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import GraphWorkspace from '../components/GraphWorkspace';
import { loadGraph, loadGraphKey } from '../data/loadGraph';
import { readPluginSettings } from '../data/pluginSettings';
import type { Graph } from '../data/types';
import styles from './GraphPage.module.css';

type State =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | {
      status: 'done';
      /** Key of the load that produced the graph: the workspace re-mounts when it changes. */
      loadKey: string;
      graph: Graph;
      requestCount: number;
      isRefreshing: boolean;
      refreshError: string | null;
    };

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export default function GraphPage({ ctx }: { ctx: RenderPageCtx }) {
  const apiToken = ctx.currentUserAccessToken;
  const { environment, cmaBaseUrl: baseUrl } = ctx;
  const permissions = ctx.currentRole.meta.final_permissions;
  const settings = readPluginSettings(ctx.plugin.attributes.parameters);
  const excludedModelApiKeys = settings.excludedModelApiKeys;
  const excludedKey = JSON.stringify(excludedModelApiKeys);
  const [state, setState] = useState<State>({ status: 'loading' });

  // A new ctx brings a new permissions object with the same content: the effect
  // depends on its string key, and reads the object through a ref.
  const loadKey = useMemo(
    () => loadGraphKey(environment, baseUrl, permissions, JSON.parse(excludedKey) as string[]),
    [environment, baseUrl, permissions, excludedKey],
  );
  const permissionsRef = useRef(permissions);
  const optionsRef = useRef({ apiToken, environment, baseUrl, excludedModelApiKeys });
  useEffect(() => {
    permissionsRef.current = permissions;
    optionsRef.current = { apiToken, environment, baseUrl, excludedModelApiKeys };
  }, [permissions, apiToken, environment, baseUrl, excludedModelApiKeys]);

  // Bumped by every load and refresh: a result applies only if no load started since.
  const generationRef = useRef(0);

  useEffect(() => {
    if (!apiToken) return;
    generationRef.current += 1;
    const generation = generationRef.current;
    const isCurrent = () => generationRef.current === generation;
    setState({ status: 'loading' });
    loadGraph({
      apiToken,
      environment,
      baseUrl,
      permissions: permissionsRef.current,
      excludedModelApiKeys: optionsRef.current.excludedModelApiKeys,
    })
      .then(({ graph, requestCount }) => {
        if (isCurrent()) {
          setState({
            status: 'done',
            loadKey,
            graph,
            requestCount,
            isRefreshing: false,
            refreshError: null,
          });
        }
      })
      .catch((error: unknown) => {
        if (isCurrent()) setState({ status: 'error', message: errorMessage(error) });
      });
    return () => {
      // Invalidates this load (and any refresh started from it).
      generationRef.current += 1;
    };
  }, [apiToken, environment, baseUrl, loadKey]);

  const reload = useCallback(() => {
    const {
      apiToken: token,
      environment: env,
      baseUrl: url,
      excludedModelApiKeys: excluded,
    } = optionsRef.current;
    if (!token) return;
    const key = loadGraphKey(env, url, permissionsRef.current, excluded);
    generationRef.current += 1;
    const generation = generationRef.current;
    const isCurrent = () => generationRef.current === generation;
    setState((s) => (s.status === 'done' ? { ...s, isRefreshing: true, refreshError: null } : s));
    loadGraph({
      apiToken: token,
      environment: env,
      baseUrl: url,
      permissions: permissionsRef.current,
      excludedModelApiKeys: excluded,
      fresh: true,
    })
      .then(({ graph, requestCount }) => {
        if (isCurrent()) {
          setState({
            status: 'done',
            loadKey: key,
            graph,
            requestCount,
            isRefreshing: false,
            refreshError: null,
          });
        }
      })
      .catch((error: unknown) => {
        if (!isCurrent()) return;
        setState((s) =>
          s.status === 'done'
            ? { ...s, isRefreshing: false, refreshError: errorMessage(error) }
            : s,
        );
      });
  }, []);

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
          key={state.loadKey}
          graph={graph}
          requestCount={state.requestCount}
          isRefreshing={state.isRefreshing}
          refreshError={state.refreshError}
          onReload={reload}
          startingModelApiKeys={settings.startingModelApiKeys}
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
