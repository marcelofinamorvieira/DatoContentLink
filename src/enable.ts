/**
 * Entry point for enabling DatoCMS visual editing overlays in the browser.
 * Orchestrates DOM observation, overlay rendering, optional dev tooling, and
 * exposes a controller so hosts can toggle the experience on and off.
 */
import { markDOMFromStega, defaultResolveEditUrl } from './stega/markFromStega.js';
import { clearGeneratedAttributes } from './dom/stamp.js';
import { annotateExplicitTargetsForDebug } from './dom/annotateDebug.js';
import { setupOverlay } from './overlay/index.js';
import { checkStegaState } from './utils/state.js';
import { normalizeBaseUrl } from './utils/url.js';
import { resolveDocument } from './utils/dom.js';
import { isDevelopment } from './utils/env.js';
import {
  EVENT_READY,
  EVENT_MARKED,
  EVENT_STATE,
  EVENT_WARN
} from './constants.js';
import type {
  EnableDatoVisualEditingOptions,
  VisualEditingController,
  MarkSummary,
  VisualEditingState,
  VisualEditingWarning
} from './types.js';
import type { DecodedInfo } from './decode/types.js';

// Internal context passed into the stega marker to keep dependencies explicit.
type MarkContext = {
  baseEditingUrl: string;
  environment?: string;
  root: ParentNode;
  debug?: boolean;
  resolveEditUrl: (info: DecodedInfo) => string | null;
};

/**
 * Boot the visual-editing runtime. When executed in a browser it returns a live
 * controller; on the server we hand back a no-op implementation so callers
 * don't have to guard their usage.
 */
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

/**
 * Browser-only implementation that manages overlay state and DOM bookkeeping.
 */
class VisualEditingControllerImpl implements VisualEditingController {
  private readonly context: MarkContext;
  private readonly root: ParentNode;
  private readonly doc: Document;
  private readonly pending = new Set<ParentNode>();
  private readonly scheduleMark: () => void;
  private readonly isDev: boolean;

  private observer: MutationObserver | null = null;
  private disposeOverlay: (() => void) | null = null;
  private enabled = false;
  private disposed = false;
  private readyEmitted = false;
  private warnedNoEditables = false;

  /**
   * Normalize options and lazily configure helpers (overlay, dev panel, etc.).
   */
  constructor(options: EnableDatoVisualEditingOptions) {
    this.root = options.root ?? document;
    this.doc = this.ensureDocument(this.root);

    const baseEditingUrl = normalizeBaseUrl(options.baseEditingUrl);
    const resolveEditUrl = this.buildResolveEditUrl(options, baseEditingUrl);

    this.context = this.buildContext(options, baseEditingUrl, resolveEditUrl);
    this.scheduleMark = createScheduler(() => this.runMark());
    this.isDev = isDevelopment();
  }

  private buildResolveEditUrl(
    options: EnableDatoVisualEditingOptions,
    baseEditingUrl: string
  ): (info: DecodedInfo) => string | null {
    if (options.resolveEditUrl) {
      return (info: DecodedInfo) =>
        options.resolveEditUrl?.(info, {
          baseEditingUrl,
          environment: options.environment
        }) ?? null;
    }

    return (info: DecodedInfo) => defaultResolveEditUrl(info, baseEditingUrl, options.environment);
  }

  private buildContext(
    options: EnableDatoVisualEditingOptions,
    baseEditingUrl: string,
    resolveEditUrl: (info: DecodedInfo) => string | null
  ): MarkContext {
    return {
      baseEditingUrl,
      environment: options.environment,
      root: this.root,
      debug: options.debug ?? false,
      resolveEditUrl
    };
  }

  private ensureDocument(root: ParentNode): Document {
    const resolved = resolveDocument(root);
    if (!resolved) {
      throw new Error('Unable to resolve document for visual editing overlays');
    }
    return resolved;
  }

  /** Start observing the DOM and stamp overlays immediately. */
  enable(): void {
    if (this.disposed || this.enabled) {
      return;
    }
    this.enabled = true;
    this.attach();
    this.emitState();
    this.runMark();
  }

  /** Tear down observers/overlays but keep the instance reusable. */
  disable(): void {
    if (!this.enabled || this.disposed) {
      return;
    }
    this.enabled = false;
    this.detach();
    this.pending.clear();
    this.emitState();
  }

  /** Convenience wrapper that flips between enable/disable. */
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

  /** Permanently shut down the controller and clear generated attributes. */
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

  /** Whether the overlays are currently active. */
  isEnabled(): boolean {
    return this.enabled;
  }

  /** Whether the controller has been disposed and cannot be re-enabled. */
  isDisposed(): boolean {
    return this.disposed;
  }

  /**
   * Re-run the stega scan for the entire tree (or a subtree) on demand.
   * Useful when content updates happen outside of mutation observers.
   */
  refresh(root?: ParentNode): void {
    if (this.disposed || !this.enabled) {
      return;
    }
    this.pending.add(root ?? this.root);
    this.scheduleMark();
  }

  /**
   * Wire up DOM observers and auxiliary UI (overlay, dev panel).
   */
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
  }

  /** Reverse everything created in `attach`, leaving the DOM untouched. */
  private detach(): void {
    if (this.observer) {
      this.observer.disconnect();
      this.observer = null;
    }
    if (this.disposeOverlay) {
      this.disposeOverlay();
      this.disposeOverlay = null;
    }
  }

  /**
   * Collect mutated subtrees so we can batch-mark them on the next tick.
   * This keeps dom writes/coalescing predictable even in noisy environments.
   */
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

  /**
   * Kick off stega decoding for all pending roots and aggregate the result.
   */
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

  /**
   * Emit events/callbacks and emit a warning the first time we detect no
   * editable nodes at the root (a common hydration gotcha).
   */
  private handleMarkResult(summary: MarkSummary): void {
    this.dispatch(EVENT_MARKED, summary);

    if (!this.readyEmitted) {
      this.readyEmitted = true;
      this.dispatch(EVENT_READY, summary);
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
      this.dispatch(EVENT_WARN, warning);
    }
  }

  /** Broadcast the current enabled/disposed flags to listeners. */
  private emitState(): void {
    const state: VisualEditingState = {
      enabled: this.enabled,
      disposed: this.disposed
    };
    this.dispatch(EVENT_STATE, state);
  }

  /**
   * Dispatch a CustomEvent when possible so non-JS integrations can observe
   * lifecycle changes.
   */
  private dispatch<T>(type: string, payload: T): void {
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

/**
 * Minimal controller used when the runtime executes outside the browser.
 * Keeps the API surface consistent without touching the DOM.
 */
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

// Debounce repeated mark requests within a microtask to avoid thrashing.
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
