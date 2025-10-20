/**
 * Overlay rendering logic: highlights editable regions under the pointer and
 * opens the editor when clicked. Lives separately from the controller so it
 * can be unit-tested and swapped out if styling needs change.
 */
import { findEditableTarget, type Target } from './resolver.js';
import { rafThrottle } from '../utils/throttle.js';

type Listener = [
  EventTarget,
  string,
  EventListenerOrEventListenerObject | ((...args: any[]) => void),
  AddEventListenerOptions | boolean | undefined
];

/**
 * Lightweight view layer that draws a fixed-position rectangle around the
 * active editable element. Keeps all DOM manipulation in one place.
 */
class HighlightOverlay {
  private root: HTMLDivElement | null = null;
  private visible = false;
  private prevCursor: string | null = null;
  private readonly padding = 8;

  constructor(private readonly doc: Document) {}

  /** Position and display the overlay around the supplied element. */
  show(el: Element): void {
    const rect = this.measure(el);
    if (!rect) {
      this.hide();
      return;
    }
    this.ensureRoot();
    if (!this.root) {
      return;
    }

    this.setCursorPointer();

    this.visible = true;
    this.root.style.display = 'block';
    this.root.style.top = `${rect.top - this.padding}px`;
    this.root.style.left = `${rect.left - this.padding}px`;
    this.root.style.width = `${rect.width + this.padding * 2}px`;
    this.root.style.height = `${rect.height + this.padding * 2}px`;
  }

  /** Re-measure the element while keeping the overlay visible. */
  update(el: Element): void {
    if (!this.visible) {
      return;
    }
    this.show(el);
  }

  /** Hide the overlay and restore the previous cursor when present. */
  hide(): void {
    if (!this.root) {
      return;
    }
    this.visible = false;
    this.root.style.display = 'none';
    this.resetCursor();
  }

  /** Remove the overlay element entirely (used during teardown). */
  dispose(): void {
    if (this.root) {
      this.root.remove();
    }
    this.root = null;
    this.visible = false;
    this.resetCursor();
  }

  /** Lazily create the overlay element with the expected styling. */
  private ensureRoot(): void {
    if (this.root) {
      return;
    }
    const body = this.doc.body;
    if (!body) {
      return;
    }
    const root = this.doc.createElement('div');
    root.style.position = 'fixed';
    root.style.top = '0';
    root.style.left = '0';
    root.style.width = '0';
    root.style.height = '0';
    root.style.border = '2px solid #ff7751';
    root.style.borderRadius = '8px';
    root.style.background = 'rgba(255, 119, 81, 0.12)';
    root.style.boxSizing = 'border-box';
    root.style.pointerEvents = 'none';
    root.style.cursor = 'pointer';
    root.style.zIndex = '2147483646';
    root.style.display = 'none';
    root.setAttribute('aria-hidden', 'true');
    body.appendChild(root);
    this.root = root;
  }

  /** Capture the current cursor so we can restore it after highlighting. */
  private setCursorPointer(): void {
    const body = this.doc.body;
    if (!body) {
      return;
    }
    if (this.prevCursor === null) {
      this.prevCursor = body.style.cursor;
    }
    body.style.cursor = 'pointer';
  }

  /** Restore the cursor that was active before the overlay appeared. */
  private resetCursor(): void {
    if (this.prevCursor === null) {
      return;
    }
    const body = this.doc.body;
    if (!body) {
      this.prevCursor = null;
      return;
    }
    const previous = this.prevCursor;
    this.prevCursor = null;
    body.style.cursor = previous;
  }

  /** Compute the bounding box for the target element, ignoring zero-size nodes. */
  private measure(el: Element): { top: number; left: number; width: number; height: number } | null {
    if (typeof el.getBoundingClientRect !== 'function') {
      return null;
    }
    const rect = el.getBoundingClientRect();
    if (rect.width === 0 && rect.height === 0) {
      return null;
    }
    return { top: rect.top, left: rect.left, width: rect.width, height: rect.height };
  }
}

/**
 * Attach the overlay to the provided document (defaulting to the global one)
 * and wire up the pointer/focus listeners required to drive it.
 * Returns a disposer that removes all listeners and DOM elements.
 */
export function setupOverlay(doc?: Document): () => void {
  const resolvedDoc = doc ?? (typeof document !== 'undefined' ? document : null);
  if (!resolvedDoc) {
    return () => void 0;
  }

  const overlay = new HighlightOverlay(resolvedDoc);
  let current: Target | null = null;
  let resizeObserver: ResizeObserver | null = null;
  const view = resolvedDoc.defaultView ?? (typeof window !== 'undefined' ? window : null);

  // Keep the overlay aligned with the active element without thrashing.
  const refresh = rafThrottle(() => {
    if (!current) {
      overlay.hide();
      return;
    }
    if (!current.el.isConnected) {
      setCurrent(null);
      return;
    }
    overlay.update(current.el);
  });

  // Watch the active element for size changes so the overlay adjusts in place.
  const observe = (target: Element | null) => {
    if (resizeObserver) {
      resizeObserver.disconnect();
      resizeObserver = null;
    }
    if (!target) {
      return;
    }
    const ResizeObserverCtor =
      resolvedDoc.defaultView?.ResizeObserver ??
      (typeof ResizeObserver !== 'undefined' ? ResizeObserver : undefined);
    if (!ResizeObserverCtor) {
      return;
    }
    resizeObserver = new ResizeObserverCtor(() => refresh());
    resizeObserver.observe(target);
  };

  // Update the highlighted element and manage resize observation lifecycle.
  const setCurrent = (next: Target | null) => {
    if (next && !next.el.isConnected) {
      next = null;
    }

    const sameTarget = current?.el === next?.el && current?.editUrl === next?.editUrl;
    current = next;

    if (!current) {
      overlay.hide();
      observe(null);
      return;
    }

    overlay.show(current.el);
    if (!sameTarget) {
      observe(current.el);
    }
  };

  // Open the edit URL in a new tab, respecting modifier keys when possible.
  const open = (target: Target, event: MouseEvent | KeyboardEvent) => {
    if (event instanceof MouseEvent && event.button !== 0) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    const opener = view ?? (typeof window !== 'undefined' ? window : null);
    opener?.open(target.editUrl, '_blank', 'noopener,noreferrer');
  };

  const handlePointer = (event: PointerEvent) => {
    // Only react to mouse pointers; touch/pen interactions would be noisy.
    if (event.pointerType && event.pointerType !== 'mouse') {
      return;
    }
    const target = findEditableTarget(event.target instanceof Element ? event.target : null);
    setCurrent(target);
  };

  const handlePointerLeave = (event: PointerEvent) => {
    if (event.pointerType && event.pointerType !== 'mouse') {
      return;
    }
    const related = event.relatedTarget instanceof Element ? event.relatedTarget : null;
    const target = findEditableTarget(related);
    if (!target) {
      setCurrent(null);
    }
  };

  const handleClick = (event: MouseEvent) => {
    const target = findEditableTarget(event.target instanceof Element ? event.target : null);
    if (!target) {
      return;
    }
    setCurrent(target);
    open(target, event);
  };

  const handleFocusIn = (event: FocusEvent) => {
    const target = findEditableTarget(event.target instanceof Element ? event.target : null);
    setCurrent(target);
  };

  const handleFocusOut = () => {
    setCurrent(null);
  };

  const handleKeyDown = (event: KeyboardEvent) => {
    if (event.key !== 'Enter' && event.key !== ' ' && event.key !== 'Spacebar') {
      return;
    }
    const active = resolvedDoc.activeElement instanceof Element ? resolvedDoc.activeElement : null;
    const target = findEditableTarget(active);
    if (!target) {
      return;
    }
    setCurrent(target);
    open(target, event);
  };

  const throttledPointer = rafThrottle(handlePointer);

  const listeners: Listener[] = [
    [resolvedDoc, 'pointerover', throttledPointer, { capture: true }],
    [resolvedDoc, 'pointermove', throttledPointer, { capture: true }],
    [resolvedDoc, 'pointerleave', handlePointerLeave, { capture: true }],
    [resolvedDoc, 'click', handleClick, { capture: true }],
    [resolvedDoc, 'focusin', handleFocusIn, { capture: true }],
    [resolvedDoc, 'focusout', handleFocusOut, { capture: true }],
    [resolvedDoc, 'keydown', handleKeyDown, { capture: true }]
  ];

  if (view) {
    listeners.push([view, 'scroll', refresh, { capture: true, passive: true }]);
    listeners.push([resolvedDoc, 'scroll', refresh, { capture: true, passive: true }]);
    listeners.push([view, 'resize', refresh, { capture: true, passive: true }]);
  } else {
    listeners.push([resolvedDoc, 'scroll', refresh, { capture: true }]);
  }

  listeners.forEach(([target, type, handler, options]) => {
    target.addEventListener(type, handler as EventListenerOrEventListenerObject, options ?? false);
  });

  return () => {
    listeners.forEach(([target, type, handler, options]) => {
      target.removeEventListener(type, handler as EventListenerOrEventListenerObject, options ?? false);
    });
    if (resizeObserver) {
      resizeObserver.disconnect();
      resizeObserver = null;
    }
    refresh.cancel();
    throttledPointer.cancel();
    overlay.dispose();
    current = null;
  };
}
