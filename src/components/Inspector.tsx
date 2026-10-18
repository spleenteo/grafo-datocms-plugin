import { Button } from 'datocms-react-ui';
import { useEffect, useMemo, useState } from 'react';
import { relationsOf, type Relation } from '../data/relationsOf';
import { fieldLabel } from '../data/types';
import type { Graph, GraphNode, NodeStatus } from '../data/types';
import { modelColor } from '../graph/modelColor';
import { STATUS_LABEL } from './labels';
import styles from './Inspector.module.css';

interface Props {
  graph: Graph;
  nodeIndex: number | null;
  /** Core and context ids currently drawn. */
  visibleIds: ReadonlySet<string>;
  colorIndex: number[];
  onSelectNode: (id: string) => void;
  onOpenNode: (index: number) => void;
  onClose: () => void;
  locale: string;
  resolveCreatorName: (creator: NonNullable<GraphNode['creator']>) => Promise<string | null>;
}

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
  locale,
  resolveCreatorName,
}: Props) {
  const creator = nodeIndex === null ? null : graph.nodes[nodeIndex].creator;
  const creatorKey = creator ? `${creator.type}:${creator.id}` : null;
  const [resolved, setResolved] = useState<{ key: string; name: string | null } | null>(null);
  const creatorName = resolved && resolved.key === creatorKey ? resolved.name : null;
  useEffect(() => {
    if (!creator || !creatorKey) return;
    let cancelled = false;
    resolveCreatorName(creator).then(
      (name) => !cancelled && setResolved({ key: creatorKey, name }),
      () => !cancelled && setResolved({ key: creatorKey, name: null }),
    );
    return () => {
      cancelled = true;
    };
  }, [creatorKey, resolveCreatorName]);
  const formatter = useMemo(() => {
    try {
      return new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' });
    } catch {
      return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' });
    }
  }, [locale]);
  const formatDate = (iso: string | null) => {
    if (!iso) return null;
    const d = new Date(iso);
    return Number.isNaN(d.getTime()) ? null : formatter.format(d);
  };

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
          <span className={styles.field}>{fieldLabel(field)}</span>
        </button>
      );
    });

  const details: [string, string][] = [];
  const created = formatDate(node.createdAt);
  const updated = formatDate(node.updatedAt);
  const published = node.publishedAt !== null ? formatDate(node.publishedAt) : null;
  if (created) details.push(['Created', created]);
  if (updated) details.push(['Last updated', updated]);
  if (published) details.push(['Published', published]);
  details.push(['Created by', creatorName ?? '—']);

  return (
    <aside className={styles.inspector}>
      <div className={styles.top}>
        <div className={styles.modelLine}>
          <span
            className={styles.dot}
            style={{ background: modelColor(colorIndex[node.model]) }}
          />
          {model.name}
        </div>
        <Button buttonType="muted" buttonSize="xxs" onClick={onClose}>
          <span aria-hidden="true">×</span>
          <span className={styles.srOnly}>Close</span>
        </Button>
      </div>
      <h2 className={styles.title}>{node.title}</h2>
      <div className={styles.badges}>
        <span className={styles.badge}>
          <span className={styles.dot} style={{ background: STATUS_COLOR[node.status] }} />
          {STATUS_LABEL[node.status]}
        </span>
      </div>
      <Button buttonType="primary" fullWidth onClick={() => onOpenNode(nodeIndex)}>
        Open record
      </Button>
      <section className={styles.section}>
        <div className={styles.heading}>Outgoing · {relations.outgoing.length}</div>
        {renderRows(relations.outgoing)}
      </section>
      <section className={styles.section}>
        <div className={styles.heading}>Incoming · {relations.incoming.length}</div>
        {renderRows(relations.incoming)}
      </section>
      <section className={styles.details}>
        <div className={styles.heading}>Details</div>
        <dl className={styles.detailList}>
          {details.map(([label, value]) => (
            <div key={label} className={styles.detailRow}>
              <dt>{label}</dt>
              <dd>{value}</dd>
            </div>
          ))}
        </dl>
      </section>
    </aside>
  );
}
