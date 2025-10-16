import { EVENT_MARKED, EVENT_STATE } from '../constants.js';
import type { StegaState } from '../utils/state.js';
import type { MarkSummary } from '../types.js';

type DevPanelPosition = 'br' | 'bl' | 'tr' | 'tl';

type DevPanelOptions = {
  position?: DevPanelPosition;
};

type ControllerStateGetter = () => { enabled: boolean; disposed: boolean };

export function setupDevPanel(
  doc: Document,
  getState: ControllerStateGetter,
  check: (root?: ParentNode) => StegaState,
  opts?: DevPanelOptions
): () => void {
  const body = doc.body;
  if (!body) {
    return () => void 0;
  }

  const root = doc.createElement('div');
  root.setAttribute('data-datocms-dev-panel', 'visual-editing');
  applyPosition(root, opts?.position ?? 'br');
  root.style.position = 'fixed';
  root.style.zIndex = '2147483647';
  root.style.pointerEvents = 'auto';
  root.style.fontFamily = 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
  root.style.fontSize = '12px';
  root.style.color = '#0f172a';
  root.style.background = 'rgba(255, 255, 255, 0.94)';
  root.style.border = '1px solid rgba(15, 23, 42, 0.2)';
  root.style.borderRadius = '6px';
  root.style.padding = '8px 10px';
  root.style.boxShadow = '0 6px 18px rgba(15, 23, 42, 0.16)';
  root.style.minWidth = '160px';
  root.style.maxWidth = '240px';
  root.style.lineHeight = '1.4';

  body.appendChild(root);

  let lastSummary: MarkSummary | null = null;

  const render = () => {
    const controller = getState();
    const stegaState = check();
    const status = controller.disposed
      ? 'disposed'
      : controller.enabled
      ? 'enabled'
      : 'disabled';

    const editableLine = `${stegaState.editableTotal} (generated ${stegaState.generatedTotal}, explicit ${stegaState.explicitTotal})`;
    const infoLine = `${stegaState.infoOnlyTotal}`;
    const encodedLine = `${stegaState.encodedTextNodes} text / ${stegaState.encodedImageAlts} alt`;

    const latestSummary = lastSummary
      ? `scope: ${describeScope(lastSummary.scope)}`
      : 'scope: –';

    root.innerHTML = `
      <strong style="display:block;margin-bottom:4px;">Dato Visual Editing</strong>
      <div><span style="font-weight:600;">Status:</span> ${status}</div>
      <div><span style="font-weight:600;">Editables:</span> ${editableLine}</div>
      <div><span style="font-weight:600;">Info-only:</span> ${infoLine}</div>
      <div><span style="font-weight:600;">Encoded:</span> ${encodedLine}</div>
      <div style="margin-top:6px;font-size:11px;color:#475569;">${latestSummary}</div>
    `;
  };

  const handleMarked = (event: Event) => {
    const custom = event as CustomEvent<MarkSummary>;
    lastSummary = custom.detail ?? null;
    render();
  };

  const handleState = (_event: Event) => {
    render();
  };

  doc.addEventListener(EVENT_MARKED, handleMarked as EventListener);
  doc.addEventListener(EVENT_STATE, handleState as EventListener);

  render();

  return () => {
    doc.removeEventListener(EVENT_MARKED, handleMarked as EventListener);
    doc.removeEventListener(EVENT_STATE, handleState as EventListener);
    root.remove();
  };
}

function applyPosition(node: HTMLElement, position: DevPanelPosition): void {
  node.style.top = '';
  node.style.right = '';
  node.style.bottom = '';
  node.style.left = '';
  switch (position) {
    case 'tr':
      node.style.top = '16px';
      node.style.right = '16px';
      break;
    case 'tl':
      node.style.top = '16px';
      node.style.left = '16px';
      break;
    case 'bl':
      node.style.bottom = '16px';
      node.style.left = '16px';
      break;
    case 'br':
    default:
      node.style.bottom = '16px';
      node.style.right = '16px';
      break;
  }
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
