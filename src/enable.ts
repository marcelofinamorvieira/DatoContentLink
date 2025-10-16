import { markDOMFromStega } from './stega/markFromStega.js';
import { clearGeneratedAttributes } from './dom/stamp.js';
import { annotateExplicitTargetsForDebug } from './dom/annotateDebug.js';
import { setupOverlay } from './overlay/index.js';
import { setupDevPanel } from './debug/devPanel.js';
import { checkStegaState } from './utils/state.js';
import {
  EVENT_READY,
  EVENT_MARKED,
  EVENT_STATE,
  EVENT_WARN
} from './constants.js';
import type {
  EnableDatoVisualEditingOptions,
  VisualEditingController,
  VisualEditingEvents,
  DevPanelOption,
  MarkSummary,
  VisualEditingState,
  VisualEditingWarning
} from './types.js';

type MarkContext = {
  baseEditingUrl: string;
  environment?: string;
  root: ParentNode;
  debug?: boolean;
};

export function enableDatoVisualEditing(
  options: EnableDatoVisualEditingOptions
): VisualEditingController {
  const autoEnable = options.autoEnable ?? true;

  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return createNoopController(autoEnable);
  }

  const controller = new VisualEditingControllerImpl(options);
  if (autoEnable) {
    controller.enable();
  }
  return controller;
}

class VisualEditingControllerImpl implements VisualEditingController {
  private readonly context: MarkContext;
  private readonly root: ParentNode;
  private readonly doc: Document;
  private readonly pending = new Set<ParentNode>();
  private readonly scheduleMark: () => void;
  private readonly callbacks: VisualEditingEvents;
  private readonly isDev: boolean;
  private readonly devPanelOption: DevPanelOption | undefined;

  private observer: MutationObserver | null = null;
  private disposeOverlay: (() => void) | null = null;
  private disposeDevPanel: (() => void) | null = null;
  private enabled = false;
  private disposed = false;
  private readyEmitted = false;
  private warnedNoEditables = false;

  constructor(options: EnableDatoVisualEditingOptions) {
    const baseEditingUrl = normalizeBaseUrl(options.baseEditingUrl);
    this.root = options.root ?? document;
    const resolvedDoc =
      this.root instanceof Document ? this.root : this.root.ownerDocument ?? document;
    if (!resolvedDoc) {
      throw new Error('Unable to resolve document for visual editing overlays');
    }
    this.doc = resolvedDoc;
    this.context = {
      baseEditingUrl,
      environment: options.environment,
      root: this.root,
      debug: options.debug ?? false
    };
    this.scheduleMark = createScheduler(() => this.runMark());
    this.callbacks = {
      onReady: options.onReady,
      onMarked: options.onMarked,
      onStateChange: options.onStateChange,
      onWarning: options.onWarning
    };
    this.devPanelOption = options.devPanel;
    this.isDev =
      typeof process !== 'undefined' && process?.env?.NODE_ENV
        ? process.env.NODE_ENV !== 'production'
        : true;
  }

  enable(): void {
    if (this.disposed || this.enabled) {
      return;
    }
    this.enabled = true;
    this.attach();
    this.emitState();
    this.runMark();
  }

  disable(): void {
    if (!this.enabled || this.disposed) {
      return;
    }
    this.enabled = false;
    this.detach();
    this.pending.clear();
    this.emitState();
  }

  toggle(): void {
    if (this.disposed) {
      return;
    }
    if (this.enabled) {
      this.disable();
    } else {
      this.enable();
    }
  }

  dispose(): void {
    if (this.disposed) {
      return;
    }
    this.disable();
    clearGeneratedAttributes(this.root);
    this.pending.clear();
    this.disposed = true;
    this.emitState();
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  isDisposed(): boolean {
    return this.disposed;
  }

  refresh(root?: ParentNode): void {
    if (this.disposed || !this.enabled) {
      return;
    }
    this.pending.add(root ?? this.root);
    this.scheduleMark();
  }

  private attach(): void {
    if (this.observer) {
      return;
    }
    this.observer = new MutationObserver((mutations) => this.handleMutations(mutations));
    this.observer.observe(this.root, {
      subtree: true,
      childList: true,
      characterData: true,
      attributes: true,
      attributeFilter: ['alt']
    });
    this.disposeOverlay = setupOverlay(this.doc);
    if (this.shouldShowDevPanel() && !this.disposeDevPanel) {
      const panelOptions =
        typeof this.devPanelOption === 'object' && this.devPanelOption ? this.devPanelOption : undefined;
      this.disposeDevPanel = setupDevPanel(
        this.doc,
        () => ({ enabled: this.enabled, disposed: this.disposed }),
        (root?: ParentNode) => checkStegaState(root ?? this.root),
        panelOptions
      );
    }
  }

  private detach(): void {
    if (this.observer) {
      this.observer.disconnect();
      this.observer = null;
    }
    if (this.disposeOverlay) {
      this.disposeOverlay();
      this.disposeOverlay = null;
    }
    if (this.disposeDevPanel) {
      this.disposeDevPanel();
      this.disposeDevPanel = null;
    }
  }

  private shouldShowDevPanel(): boolean {
    return Boolean(this.devPanelOption) && this.isDev;
  }

  private handleMutations(mutations: MutationRecord[]): void {
    if (!this.enabled || this.disposed) {
      this.pending.clear();
      return;
    }

    let hasChanges = false;
    for (const mutation of mutations) {
      if (mutation.type === 'characterData') {
        const node = mutation.target as Node;
        const parent = (node.parentElement ?? node.parentNode ?? this.root) as ParentNode;
        this.pending.add(parent);
        hasChanges = true;
        continue;
      }
      if (mutation.type === 'attributes') {
        if (mutation.attributeName === 'alt') {
          const element = mutation.target as Element;
          this.pending.add((element.parentElement ?? this.root) as ParentNode);
          hasChanges = true;
        }
        continue;
      }
      if (mutation.type === 'childList') {
        this.pending.add(mutation.target as ParentNode);
        mutation.addedNodes.forEach((node) => {
          if (node.nodeType === Node.ELEMENT_NODE || node.nodeType === Node.DOCUMENT_FRAGMENT_NODE) {
            this.pending.add(node as ParentNode);
          }
        });
        hasChanges = true;
      }
    }
    if (hasChanges) {
      this.scheduleMark();
    }
  }

  private runMark(): void {
    if (!this.enabled || this.disposed) {
      this.pending.clear();
      return;
    }

    const contexts =
      this.pending.size === 0
        ? [this.context]
        : Array.from(this.pending).map((subtree) => ({ ...this.context, root: subtree }));
    this.pending.clear();

    const summaries: MarkSummary[] = [];

    for (const ctx of contexts) {
      const summary = markDOMFromStega(ctx);
      summaries.push(summary);
      if (this.context.debug) {
        annotateExplicitTargetsForDebug(ctx);
      }
    }

    if (summaries.length === 0) {
      return;
    }

    let combined: MarkSummary;
    if (summaries.length === 1) {
      combined = summaries[0];
    } else {
      const state = checkStegaState(this.root);
      combined = {
        editableTotal: state.editableTotal,
        explicitTotal: state.explicitTotal,
        generatedStamped: summaries.reduce((acc, item) => acc + item.generatedStamped, 0),
        generatedUpdated: summaries.reduce((acc, item) => acc + item.generatedUpdated, 0),
        scope: this.root
      };
    }

    this.handleMarkResult(combined);
  }

  private handleMarkResult(summary: MarkSummary): void {
    this.emit(EVENT_MARKED, this.callbacks.onMarked, summary);

    if (!this.readyEmitted) {
      this.readyEmitted = true;
      this.emit(EVENT_READY, this.callbacks.onReady, summary);
    }

    if (
      this.isDev &&
      !this.warnedNoEditables &&
      summary.scope === this.root &&
      summary.editableTotal === 0
    ) {
      this.warnedNoEditables = true;
      const message =
        '[datocms-visual-editing] no editable elements were detected after enable().\n' +
        'if you’re hydrating/streaming, do not replace the server-rendered nodes that carry _editingUrl/stega markers.\n' +
        'reuse the exact DOM and render into it.';
      console.warn(message);
      const warning: VisualEditingWarning = {
        code: 'no-editables',
        message
      };
      this.emit(EVENT_WARN, this.callbacks.onWarning, warning);
    }
  }

  private emitState(): void {
    const state: VisualEditingState = {
      enabled: this.enabled,
      disposed: this.disposed
    };
    this.emit(EVENT_STATE, this.callbacks.onStateChange, state);
  }

  private emit<T>(
    type: string,
    callback: ((payload: T) => void) | undefined,
    payload: T
  ): void {
    try {
      callback?.(payload);
    } catch (error) {
      if (this.isDev) {
        console.error('[datocms-visual-editing] listener for', type, 'threw', error);
      }
    }

    const CustomEventCtor =
      this.doc.defaultView?.CustomEvent ?? (typeof CustomEvent !== 'undefined' ? CustomEvent : undefined);
    if (!CustomEventCtor) {
      return;
    }

    try {
      const event = new CustomEventCtor(type, { detail: payload });
      this.doc.dispatchEvent(event);
    } catch {
      // Ignore dispatch failures (e.g. CustomEvent polyfill not available)
    }
  }
}

function createNoopController(autoEnable: boolean): VisualEditingController {
  let enabled = autoEnable;
  let disposed = false;

  return {
    enable() {
      if (disposed) {
        return;
      }
      enabled = true;
    },
    disable() {
      if (disposed) {
        return;
      }
      enabled = false;
    },
    toggle() {
      if (disposed) {
        return;
      }
      enabled = !enabled;
    },
    dispose() {
      disposed = true;
      enabled = false;
    },
    isEnabled() {
      return !disposed && enabled;
    },
    isDisposed() {
      return disposed;
    },
    refresh() {
      // no-op on the server
    }
  };
}

function normalizeBaseUrl(url: string): string {
  if (!url) {
    throw new Error('baseEditingUrl is required');
  }

  const trimmed = url.trim();
  const sanitized = trimmed.endsWith('/') ? trimmed.slice(0, -1) : trimmed;
  try {
    const parsed = new URL(sanitized);
    return `${parsed.origin}${parsed.pathname.replace(/\/$/, '')}`;
  } catch {
    throw new Error('baseEditingUrl must be a valid URL');
  }
}

function createScheduler(fn: () => void): () => void {
  let pending = false;
  const enqueue =
    typeof queueMicrotask === 'function'
      ? queueMicrotask
      : (cb: () => void) => Promise.resolve().then(cb);
  return () => {
    if (pending) {
      return;
    }
    pending = true;
    enqueue(() => {
      pending = false;
      fn();
    });
  };
}
