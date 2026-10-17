import type { RenderPageCtx } from 'datocms-plugin-sdk';
import { Canvas } from 'datocms-react-ui';
import styles from './GraphPage.module.css';

export default function GraphPage({ ctx }: { ctx: RenderPageCtx }) {
  return (
    <Canvas ctx={ctx} noAutoResizer>
      <div className={styles.page}>
        <h1 className={styles.title}>Content Graph</h1>
        <p className={styles.hint}>Record relations will appear here.</p>
      </div>
    </Canvas>
  );
}
