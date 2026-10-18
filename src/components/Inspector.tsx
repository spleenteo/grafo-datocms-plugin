import { Button } from 'datocms-react-ui';
import { useMemo } from 'react';
import { relationsOf, type Relation } from '../data/relationsOf';
import type { Graph, NodeStatus } from '../data/types';
import { modelColor } from '../graph/modelColor';
import styles from './Inspector.module.css';

interface Props {
  graph: Graph;
  nodeIndex: number | null;
  /** Core and context ids currently drawn. */
  visibleIds: Set<string>;
  colorIndex: number[];
  onSelectNode: (id: string) => void;
  onOpenNode: (index: number) => void;
  onClose: () => void;
}

const STATUS_LABEL: Record<NodeStatus, string> = {
  published: 'Published',
  updated: 'Updated',
  draft: 'Draft',
};

const STATUS_COLOR: Record<NodeStatus, string> = {
  published: 'var(--color--ink-success)',
  updated: 'var(--color--ink-warning)',
  draft: 'var(--color--ink-subtle)',
};

export default function Inspector({
  graph,
  nodeIndex,
  visibleIds,
  colorIndex,
  onSelectNode,
  onOpenNode,
  onClose,
}: Props) {
  const relations = useMemo(
    () => (nodeIndex === null ? null : relationsOf(graph, nodeIndex)),
    [graph, nodeIndex],
  );

  if (nodeIndex === null || !relations) {
    return (
      <aside className={styles.inspector}>
        <p className={styles.empty}>Select a record to see its relations.</p>
      </aside>
    );
  }

  const node = graph.nodes[nodeIndex];
  const model = graph.models[node.model];

  const renderRows = (list: Relation[]) =>
    list.map((r, i) => {
      const other = graph.nodes[r.nodeIndex];
      const field = graph.fields[r.field];
      const isVisible = visibleIds.has(other.id);
      return (
        <button
          key={`${r.nodeIndex}-${r.field}-${i}`}
          type="button"
          className={`${styles.row} ${isVisible ? '' : styles.hidden}`}
          aria-label={isVisible ? undefined : `${other.title}, hidden by filters, opens the record`}
          title={isVisible ? undefined : 'Hidden by the filters: opens the record'}
          onClick={() => (isVisible ? onSelectNode(other.id) : onOpenNode(r.nodeIndex))}
        >
          <span
            className={styles.dot}
            style={{ background: modelColor(colorIndex[other.model]) }}
          />
          <span className={styles.rowTitle}>{other.title}</span>
          <span className={styles.field}>{field.isPseudo ? 'parent (tree)' : field.apiKey}</span>
        </button>
      );
    });

  return (
    <aside className={styles.inspector}>
      <div className={styles.top}>
        <div className={styles.badges}>
          <span className={styles.badge}>
            <span
              className={styles.dot}
              style={{ background: modelColor(colorIndex[node.model]) }}
            />
            {model.name}
          </span>
          <span className={styles.badge}>
            <span className={styles.dot} style={{ background: STATUS_COLOR[node.status] }} />
            {STATUS_LABEL[node.status]}
          </span>
        </div>
        <Button buttonType="muted" buttonSize="xxs" onClick={onClose}>
          <span aria-hidden="true">×</span>
          <span className={styles.srOnly}>Close</span>
        </Button>
      </div>
      <h2 className={styles.title}>{node.title}</h2>
      <section className={styles.section}>
        <div className={styles.heading}>Outgoing · {relations.outgoing.length}</div>
        {renderRows(relations.outgoing)}
      </section>
      <section className={styles.section}>
        <div className={styles.heading}>Incoming · {relations.incoming.length}</div>
        {renderRows(relations.incoming)}
      </section>
      <Button buttonType="primary" fullWidth onClick={() => onOpenNode(nodeIndex)}>
        Open record
      </Button>
    </aside>
  );
}
