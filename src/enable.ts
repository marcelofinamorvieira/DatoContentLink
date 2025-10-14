import { markDOMFromStega } from './stega/markFromStega.js';
import { clearGeneratedAttributes } from './dom/stamp.js';
import { annotateExplicitTargetsForDebug } from './dom/annotateDebug.js';
import { setupOverlay } from './overlay/index.js';
import type { EnableDatoVisualEditingOptions, VisualEditingController } from './types.js';

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

  private observer: MutationObserver | null = null;
  private disposeOverlay: (() => void) | null = null;
  private enabled = false;
  private disposed = false;

  constructor(private readonly options: EnableDatoVisualEditingOptions) {
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
  }

  enable(): void {
    if (this.disposed || this.enabled) {
      return;
    }
    this.enabled = true;
    this.attach();
    this.runMark();
  }

  disable(): void {
    if (!this.enabled || this.disposed) {
      return;
    }
    this.enabled = false;
    this.detach();
    this.pending.clear();
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
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  isDisposed(): boolean {
    return this.disposed;
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
  }

  private handleMutations(mutations: MutationRecord[]): void {
    if (!this.enabled || this.disposed) {
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
          if (
            node.nodeType === Node.ELEMENT_NODE ||
            node.nodeType === Node.DOCUMENT_FRAGMENT_NODE
          ) {
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

    if (this.pending.size === 0) {
      markDOMFromStega(this.context);
      if (this.context.debug) {
        annotateExplicitTargetsForDebug(this.context);
      }
      return;
    }

    for (const subtree of this.pending) {
      const subContext = { ...this.context, root: subtree };
      markDOMFromStega(subContext);
      if (this.context.debug) {
        annotateExplicitTargetsForDebug(subContext);
      }
    }
    this.pending.clear();
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
