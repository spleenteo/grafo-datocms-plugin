import type { RenderPageCtx } from 'datocms-plugin-sdk';
import { Canvas, Spinner } from 'datocms-react-ui';
import type { ReactNode } from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import GraphWorkspace from '../components/GraphWorkspace';
import { loadGraph, loadGraphKey } from '../data/loadGraph';
import { readPluginSettings } from '../data/pluginSettings';
import type { Graph } from '../data/types';
import { createGenerationGuard } from '../utils/generationGuard';
import { errorMessage } from '../utils/errorMessage';
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

export default function GraphPage({ ctx }: { ctx: RenderPageCtx }) {
  const apiToken = ctx.currentUserAccessToken;
  const { environment, cmaBaseUrl: baseUrl } = ctx;
  const permissions = ctx.currentRole.meta.final_permissions;
  const userId = ctx.currentUser.id;
  const parameters = ctx.plugin.attributes.parameters;
  const settings = useMemo(() => readPluginSettings(parameters), [parameters]);
  const excludedModelApiKeys = settings.excludedModelApiKeys;
  const [state, setState] = useState<State>({ status: 'loading' });

  // A new ctx brings a new permissions object with the same content: the effect
  // depends on this string key, and reads the object through a ref.
  const loadKey = loadGraphKey(environment, baseUrl, userId, permissions, excludedModelApiKeys);
  const permissionsRef = useRef(permissions);
  const optionsRef = useRef({ apiToken, environment, baseUrl, userId, excludedModelApiKeys });
  useEffect(() => {
    permissionsRef.current = permissions;
    optionsRef.current = { apiToken, environment, baseUrl, userId, excludedModelApiKeys };
  }, [permissions, apiToken, environment, baseUrl, userId, excludedModelApiKeys]);

  // Bumped by every load and refresh: a result applies only if no load started since.
  const generationRef = useRef(createGenerationGuard());

  useEffect(() => {
    if (!apiToken) return;
    const guard = generationRef.current;
    const generation = guard.next();
    const isCurrent = () => guard.isCurrent(generation);
    setState({ status: 'loading' });
    loadGraph({
      apiToken,
      environment,
      baseUrl,
      userId,
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
      generationRef.current.next();
    };
  }, [apiToken, loadKey]);

  const reload = useCallback(() => {
    const {
      apiToken: token,
      environment: env,
      baseUrl: url,
      userId: user,
      excludedModelApiKeys: excluded,
    } = optionsRef.current;
    if (!token) return;
    const key = loadGraphKey(env, url, user, permissionsRef.current, excluded);
    const guard = generationRef.current;
    const generation = guard.next();
    const isCurrent = () => guard.isCurrent(generation);
    setState((s) => (s.status === 'done' ? { ...s, isRefreshing: true, refreshError: null } : s));
    loadGraph({
      apiToken: token,
      environment: env,
      baseUrl: url,
      userId: user,
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
        Grafo needs the currentUserAccessToken permission. Ask an administrator to grant it in Configuration → Plugins → Grafo.
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
          storageKey={`grafo:filters:v1:${ctx.site.id}:${ctx.environment}:${ctx.currentUser.type}:${ctx.currentUser.id}`}
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
