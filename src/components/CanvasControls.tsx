import {
  Button,
  ButtonGroup,
  ButtonGroupButton,
  TextInput,
} from "datocms-react-ui";
import type { KeyboardEvent } from "react";
import type { LabelMode } from "../graph/renderGraph";
import styles from "./CanvasControls.module.css";

interface Props {
  query: string;
  onQueryChange: (query: string) => void;
  onSearchEnter: () => void;
  matchCount: number;
  labelMode: LabelMode;
  onLabelModeChange: (mode: LabelMode) => void;
  distance: number;
  onDistanceChange: (distance: number) => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onFit: () => void;
  onRelayout: () => void;
  stats: string;
  onReload?: () => void;
  isReloadDisabled: boolean;
}

const LABEL_MODES: { mode: LabelMode; label: string }[] = [
  { mode: "smart", label: "Smart" },
  { mode: "all", label: "All" },
  { mode: "focus", label: "On focus" },
];

function matchLine(query: string, count: number): string | null {
  if (!query.trim()) return null;
  if (count === 0) return "No matches";
  if (count === 1) return "1 match, press Enter to jump to it";
  return `${count} matches, press Enter to jump to the first`;
}

export default function CanvasControls(props: Props) {
  const { query, matchCount, labelMode, distance, onReload, isReloadDisabled } =
    props;
  const line = matchLine(query, matchCount);

  const onSearchKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    // Keep node keyboard handlers and the workspace Escape out of the input.
    event.stopPropagation();
    if (event.key === "Enter") {
      event.preventDefault();
      props.onSearchEnter();
    } else if (event.key === "Escape") {
      props.onQueryChange("");
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
            {line ?? ""}
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
                {labelMode === mode && (
                  <span className={styles.srOnly}> (selected)</span>
                )}
              </ButtonGroupButton>
            ))}
          </ButtonGroup>
        </div>
      </div>

      <div className={styles.bottomBar}>
        <p className={`${styles.stats} ${styles.auto}`}>
          <span>{props.stats}</span>
          <Button
            buttonSize="xxs"
            onClick={onReload}
            disabled={isReloadDisabled || !onReload}
          >
            Reload
          </Button>
        </p>
        <div className={styles.bottomRight}>
          <label className={`${styles.distance} ${styles.auto}`}>
            <span>Distance</span>
            <input
              type="range"
              min={0.4}
              max={3}
              step={0.05}
              value={distance}
              aria-label="Node distance"
              onChange={(e) => props.onDistanceChange(Number(e.target.value))}
            />
            <span className={styles.distanceValue}>{distance.toFixed(1)}×</span>
          </label>
          <div className={`${styles.zoomStack} ${styles.auto}`}>
            <button type="button" title="Zoom in" onClick={props.onZoomIn}>
              <span aria-hidden="true">+</span>
              <span className={styles.srOnly}>Zoom in</span>
            </button>
            <button type="button" title="Zoom out" onClick={props.onZoomOut}>
              <span aria-hidden="true">−</span>
              <span className={styles.srOnly}>Zoom out</span>
            </button>
            <button type="button" title="Fit to screen" onClick={props.onFit}>
              <span aria-hidden="true">⤢</span>
              <span className={styles.srOnly}>Fit to screen</span>
            </button>
            <button type="button" title="Relayout" onClick={props.onRelayout}>
              <span aria-hidden="true">↻</span>
              <span className={styles.srOnly}>Relayout</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
