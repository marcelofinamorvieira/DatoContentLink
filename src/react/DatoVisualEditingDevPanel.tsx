import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import type { JSX } from 'react';
import { EVENT_MARKED, EVENT_STATE } from '../constants.js';
import { checkStegaState, type StegaState } from '../utils/state.js';
import type { MarkSummary, VisualEditingState } from '../types.js';

export type DevPanelPosition = 'br' | 'bl' | 'tr' | 'tl';

export type DatoVisualEditingDevPanelProps = {
  position?: DevPanelPosition;
};

type PanelSnapshot = {
  stega: StegaState | null;
  controller: VisualEditingState | null;
  summary: MarkSummary | null;
};

const baseStyle: CSSProperties = {
  position: 'fixed',
  zIndex: 2147483647,
  pointerEvents: 'auto',
  fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  fontSize: 12,
  color: '#0f172a',
  background: 'rgba(255, 255, 255, 0.94)',
  border: '1px solid rgba(15, 23, 42, 0.2)',
  borderRadius: 6,
  padding: '8px 10px',
  boxShadow: '0 6px 18px rgba(15, 23, 42, 0.16)',
  minWidth: 160,
  maxWidth: 260,
  lineHeight: 1.4
};

const labelStyle: CSSProperties = {
  fontWeight: 600
};

export function DatoVisualEditingDevPanel(
  props: DatoVisualEditingDevPanelProps
): JSX.Element | null {
  const position = props.position ?? 'br';

  const [snapshot, setSnapshot] = useState<PanelSnapshot>(() => ({
    stega: typeof document === 'undefined' ? null : checkStegaState(document),
    controller: null,
    summary: null
  }));

  useEffect(() => {
    if (typeof document === 'undefined') {
      return;
    }

    const updateStega = () => {
      setSnapshot((prev) => ({
        ...prev,
        stega: checkStegaState(document)
      }));
    };

    const handleMarked = (event: Event) => {
      const summary = (event as CustomEvent<MarkSummary>).detail ?? null;
      setSnapshot((prev) => ({
        ...prev,
        summary,
        stega: checkStegaState(document)
      }));
    };

    const handleState = (event: Event) => {
      const controller = (event as CustomEvent<VisualEditingState>).detail ?? null;
      setSnapshot((prev) => ({
        ...prev,
        controller
      }));
    };

    document.addEventListener(EVENT_MARKED, handleMarked as EventListener);
    document.addEventListener(EVENT_STATE, handleState as EventListener);
    updateStega();

    return () => {
      document.removeEventListener(EVENT_MARKED, handleMarked as EventListener);
      document.removeEventListener(EVENT_STATE, handleState as EventListener);
    };
  }, []);

  if (typeof document === 'undefined') {
    return null;
  }

  const { stega, controller, summary } = snapshot;
  if (!stega) {
    return null;
  }

  const status = controller
    ? controller.disposed
      ? 'disposed'
      : controller.enabled
      ? 'enabled'
      : 'disabled'
    : 'unknown';

  const positionStyle = useMemo(() => getPositionStyle(position), [position]);
  const scopeLabel = summary ? describeScope(summary.scope) : '–';

  const editableLine = `${stega.editableTotal} (generated ${stega.generatedTotal}, explicit ${stega.explicitTotal})`;
  const infoOnly = `${stega.infoOnlyTotal}`;
  const encoded = `${stega.encodedTextNodes} text / ${stega.encodedImageAlts} alt`;
  const editableSamples = stega.samples.editable?.join(', ');
  const infoSamples = stega.samples.infoOnly?.join(', ');

  return (
    <div style={{ ...baseStyle, ...positionStyle }}>
      <strong style={{ display: 'block', marginBottom: 4 }}>Dato Visual Editing</strong>
      <div>
        <span style={labelStyle}>Status:</span> {status}
      </div>
      <div>
        <span style={labelStyle}>Editables:</span> {editableLine}
      </div>
      <div>
        <span style={labelStyle}>Info-only:</span> {infoOnly}
      </div>
      <div>
        <span style={labelStyle}>Encoded:</span> {encoded}
      </div>
      <div style={{ marginTop: 6, fontSize: 11, color: '#475569' }}>scope: {scopeLabel}</div>
      {editableSamples ? (
        <div style={{ marginTop: 6, fontSize: 11 }}>
          <span style={labelStyle}>Editable samples:</span> {editableSamples}
        </div>
      ) : null}
      {infoSamples ? (
        <div style={{ marginTop: 2, fontSize: 11 }}>
          <span style={labelStyle}>Info-only samples:</span> {infoSamples}
        </div>
      ) : null}
    </div>
  );
}

function getPositionStyle(position: DevPanelPosition): CSSProperties {
  const style: CSSProperties = {
    top: undefined,
    right: undefined,
    bottom: undefined,
    left: undefined
  };
  switch (position) {
    case 'tr':
      style.top = 16;
      style.right = 16;
      break;
    case 'tl':
      style.top = 16;
      style.left = 16;
      break;
    case 'bl':
      style.bottom = 16;
      style.left = 16;
      break;
    case 'br':
    default:
      style.bottom = 16;
      style.right = 16;
      break;
  }
  return style;
}

function describeScope(scope: ParentNode): string {
  if (!(scope instanceof Element)) {
    return 'document';
  }
  const id = scope.id ? `#${scope.id}` : '';
  const cls = (scope.getAttribute('class') ?? '')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((token) => `.${token}`)
    .join('');
  return `${scope.tagName.toLowerCase()}${id}${cls}`;
}
