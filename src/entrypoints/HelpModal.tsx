import type { RenderModalCtx } from 'datocms-plugin-sdk';
import { Canvas } from 'datocms-react-ui';
import styles from './HelpModal.module.css';

const SHORTCUTS: [string, string][] = [
  ['Tab / Shift+Tab', 'Move between records'],
  ['Enter or Space', 'Select the focused record'],
  ['Esc', 'Clear the selection'],
  ['Enter in search', 'Jump to the first match'],
  ['Esc in search', 'Clear the search'],
  ['Double-click a model', 'Show only that model'],
  ['Mouse wheel / drag on empty canvas', 'Zoom / pan'],
  ['Drag a record', 'Move it'],
];

export default function HelpModal({ ctx }: { ctx: RenderModalCtx }) {
  return (
    <Canvas ctx={ctx}>
      <div className={styles.root}>
        <section className={styles.section}>
          <h2 className={styles.heading}>Keyboard shortcuts</h2>
          <table className={styles.table}>
            <tbody>
              {SHORTCUTS.map(([keys, description]) => (
                <tr key={keys}>
                  <td>
                    <span className={styles.kbd}>{keys}</span>
                  </td>
                  <td>{description}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
        <section className={styles.section}>
          <h2 className={styles.heading}>How to read the graph</h2>
          <ul className={styles.list}>
            <li>Node = record. Colour = model. Size = number of relations.</li>
            <li>Ring = published with unpublished changes. Dashed = draft.</li>
            <li>
              Faded dot or italic label = record outside the selected models (shown because of
              "Relations outside selection").
            </li>
            <li>Arrows go from the record that holds the link to the linked record.</li>
            <li>Links inside blocks and Structured Text count for the field that holds them.</li>
          </ul>
        </section>
        <section>
          <h2 className={styles.heading}>What you see</h2>
          <p className={styles.text}>
            Only records your role can read. Data is loaded when Grafo opens and with Reload.
          </p>
        </section>
      </div>
    </Canvas>
  );
}
