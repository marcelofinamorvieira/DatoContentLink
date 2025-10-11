import { findEditableTarget, type Target } from './resolver.js';
import { rafThrottle } from '../utils/throttle.js';

type Listener = [
  EventTarget,
  string,
  EventListenerOrEventListenerObject | ((...args: any[]) => void),
  AddEventListenerOptions | boolean | undefined
];

class HighlightOverlay {
  private root: HTMLDivElement | null = null;
  private visible = false;

  constructor(private readonly doc: Document) {}

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

    this.visible = true;
    this.root.style.display = 'block';
    this.root.style.top = `${rect.top}px`;
    this.root.style.left = `${rect.left}px`;
    this.root.style.width = `${rect.width}px`;
    this.root.style.height = `${rect.height}px`;
  }

  update(el: Element): void {
    if (!this.visible) {
      return;
    }
    this.show(el);
  }

  hide(): void {
    if (!this.root) {
      return;
    }
    this.visible = false;
    this.root.style.display = 'none';
  }

  dispose(): void {
    if (this.root) {
      this.root.remove();
    }
    this.root = null;
    this.visible = false;
  }

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
    root.style.zIndex = '2147483646';
    root.style.display = 'none';
    root.setAttribute('aria-hidden', 'true');
    body.appendChild(root);
    this.root = root;
  }

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

export function setupOverlay(doc?: Document): () => void {
  const resolvedDoc = doc ?? (typeof document !== 'undefined' ? document : null);
  if (!resolvedDoc) {
    return () => void 0;
  }

  const overlay = new HighlightOverlay(resolvedDoc);
  let current: Target | null = null;
  let resizeObserver: ResizeObserver | null = null;
  const view = resolvedDoc.defaultView ?? (typeof window !== 'undefined' ? window : null);

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
