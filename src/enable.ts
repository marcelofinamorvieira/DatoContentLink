import { markDOMFromStega } from './stega/markFromStega.js';
import { clearGeneratedAttributes } from './dom/stamp.js';
import { annotateExplicitTargetsForDebug } from './dom/annotateDebug.js';
import { setupOverlay } from './overlay/index.js';
import type { EnableDatoVisualEditingOptions } from './types.js';

type MarkContext = {
  baseEditingUrl: string;
  environment?: string;
  root: ParentNode;
  debug?: boolean;
};

export function enableDatoVisualEditing(options: EnableDatoVisualEditingOptions): () => void {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return () => void 0;
  }

  const baseEditingUrl = normalizeBaseUrl(options.baseEditingUrl);
  const root = options.root ?? document;
  const context: MarkContext = {
    baseEditingUrl,
    environment: options.environment,
    root,
    debug: options.debug ?? false
  };

  const pending = new Set<ParentNode>();

  const runMark = () => {
    if (pending.size === 0) {
      markDOMFromStega(context);
      if (context.debug) {
        annotateExplicitTargetsForDebug(context);
      }
      return;
    }

    for (const subtree of pending) {
      const subContext = { ...context, root: subtree };
      markDOMFromStega(subContext);
      if (context.debug) {
        annotateExplicitTargetsForDebug(subContext);
      }
    }
    pending.clear();
  };
  const scheduleMark = createScheduler(runMark);

  runMark();

  const observer = new MutationObserver((mutations) => {
    let hasChanges = false;
    for (const mutation of mutations) {
      if (mutation.type === 'characterData') {
        const node = mutation.target as Node;
        const parent = (node.parentElement ?? node.parentNode ?? context.root) as ParentNode;
        pending.add(parent);
        hasChanges = true;
        continue;
      }
      if (mutation.type === 'attributes') {
        if (mutation.attributeName === 'alt') {
          const element = mutation.target as Element;
          pending.add((element.parentElement ?? context.root) as ParentNode);
          hasChanges = true;
        }
        continue;
      }
      if (mutation.type === 'childList') {
        pending.add(mutation.target as ParentNode);
        mutation.addedNodes.forEach((node) => {
          if (node.nodeType === Node.ELEMENT_NODE || node.nodeType === Node.DOCUMENT_FRAGMENT_NODE) {
            pending.add(node as ParentNode);
          }
        });
        hasChanges = true;
      }
    }
    if (hasChanges) {
      scheduleMark();
    }
  });

  observer.observe(root, {
    subtree: true,
    childList: true,
    characterData: true,
    attributes: true,
    attributeFilter: ['alt']
  });

  const doc = root instanceof Document ? root : root.ownerDocument ?? document;
  const disposeOverlay = setupOverlay(doc);

  return () => {
    observer.disconnect();
    disposeOverlay();
    clearGeneratedAttributes(root);
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
  const enqueue = typeof queueMicrotask === 'function'
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
