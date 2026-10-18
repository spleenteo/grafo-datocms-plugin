import { Button, ButtonGroup, ButtonGroupButton, TextInput } from 'datocms-react-ui';
import type { KeyboardEvent, ReactNode } from 'react';
import type { LabelMode } from '../graph/renderGraph';
import styles from './CanvasControls.module.css';

function Icon({ children }: { children: ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={16}
      height={16}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

const PlusIcon = () => (
  <Icon>
    <path d="M12 5v14" />
    <path d="M5 12h14" />
  </Icon>
);
const MinusIcon = () => (
  <Icon>
    <path d="M5 12h14" />
  </Icon>
);
const FrameIcon = () => (
  <Icon>
    <path d="M4 9V4h5" />
    <path d="M15 4h5v5" />
    <path d="M20 15v5h-5" />
    <path d="M9 20H4v-5" />
  </Icon>
);
const ShuffleIcon = () => (
  <Icon>
    <path d="M16 3h5v5" />
    <path d="M4 20L21 3" />
    <path d="M21 16v5h-5" />
    <path d="M15 15l6 6" />
    <path d="M4 4l5 5" />
  </Icon>
);

interface Props {
  query: string;
  onQueryChange: (query: string) => void;
  onSearchEnter: () => void;
  matchCount: number;
  labelMode: LabelMode;
  onLabelModeChange: (mode: LabelMode) => void;
  distance: number;
  onDistanceChange: (distance: number) => void;
  isAutoDistance: boolean;
  onAutoDistanceToggle: () => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onFit: () => void;
  onRelayout: () => void;
  stats: string;
  statsTitle?: string;
  onReload: () => void;
  isReloadDisabled: boolean;
}

const LABEL_MODES: { mode: LabelMode; label: string }[] = [
  { mode: 'smart', label: 'Smart' },
  { mode: 'all', label: 'All' },
  { mode: 'focus', label: 'On focus' },
];

function matchLine(query: string, count: number): string | null {
  if (!query.trim()) return null;
  if (count === 0) return 'No matches';
  if (count === 1) return '1 match, press Enter to jump to it';
  return `${count} matches, press Enter to jump to the first`;
}

export default function CanvasControls(props: Props) {
  const { query, matchCount, labelMode, distance, isAutoDistance, onReload, isReloadDisabled } = props;
  const line = matchLine(query, matchCount);

  const onSearchKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    // Keep node keyboard handlers and the workspace Escape out of the input.
    event.stopPropagation();
    if (event.key === 'Enter') {
      event.preventDefault();
      props.onSearchEnter();
    } else if (event.key === 'Escape') {
      props.onQueryChange('');
    }
  };

  return (
    <div className={styles.controls}>
      <div className={`${styles.corner} ${styles.topLeft}`}>
        <div className={`${styles.search} ${styles.auto}`}>
          <TextInput
            id="grafo-search"
            name="grafo-search"
            placeholder="Search titles"
            aria-label="Search titles"
            value={query}
            onChange={props.onQueryChange}
            onKeyDown={onSearchKeyDown}
          />
          <p className={styles.matchLine} role="status">
            {line ?? ''}
          </p>
        </div>
      </div>

      <div className={`${styles.corner} ${styles.topRight}`}>
        <div className={styles.auto} role="group" aria-label="Labels">
          <ButtonGroup>
            {LABEL_MODES.map(({ mode, label }) => (
              <ButtonGroupButton
                key={mode}
                selected={labelMode === mode}
                onClick={() => props.onLabelModeChange(mode)}
              >
                {label}
                {labelMode === mode && <span className={styles.srOnly}> (selected)</span>}
              </ButtonGroupButton>
            ))}
          </ButtonGroup>
        </div>
      </div>

      <div className={styles.bottomBar}>
        <p className={`${styles.stats} ${styles.auto}`}>
          <span title={props.statsTitle}>{props.stats}</span>
          <Button buttonSize="xxs" onClick={onReload} disabled={isReloadDisabled}>
            Reload
          </Button>
        </p>
        <div className={styles.bottomRight}>
          <div className={`${styles.distance} ${styles.auto}`}>
            <span aria-hidden="true">Distance</span>
            <button
              type="button"
              className={styles.autoToggle}
              aria-pressed={isAutoDistance}
              title="Set the distance from the number of visible records and the canvas size"
              onClick={props.onAutoDistanceToggle}
            >
              Auto
              {isAutoDistance && <span className={styles.srOnly}> (on)</span>}
            </button>
            <input
              id="grafo-distance"
              type="range"
              min={0.4}
              max={3}
              step={0.05}
              value={distance}
              aria-label="Node distance"
              onChange={(e) => props.onDistanceChange(Number(e.target.value))}
            />
            <span className={styles.distanceValue}>{Number(distance.toFixed(2))}×</span>
          </div>
          <div className={`${styles.zoomStack} ${styles.auto}`}>
            <button type="button" title="Zoom in" onClick={props.onZoomIn}>
              <PlusIcon />
              <span className={styles.srOnly}>Zoom in</span>
            </button>
            <button type="button" title="Zoom out" onClick={props.onZoomOut}>
              <MinusIcon />
              <span className={styles.srOnly}>Zoom out</span>
            </button>
            <button type="button" title="Fit to screen" onClick={props.onFit}>
              <FrameIcon />
              <span className={styles.srOnly}>Fit to screen</span>
            </button>
            <button type="button" title="Rearrange layout" onClick={props.onRelayout}>
              <ShuffleIcon />
              <span className={styles.srOnly}>Rearrange layout</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
