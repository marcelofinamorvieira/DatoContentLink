import { StegaObserver, type TextStegaMatch, type ImageStegaMatch } from './dom/observer.js';
import { OverlayManager } from './dom/overlays.js';
import { measureElement, rectsForTextNode, pointInBox, type OverlayBoxes } from './dom/measure.js';
import { buildDatoDeepLink } from './link/buildDatoDeepLink.js';
import { normalizeFieldPath } from './link/fieldPath.js';
import { DecodedInfo } from './decode/types.js';
import { resolveHighlightContainer, TargetAttribute } from './utils/attr.js';
import { isElement, isHTMLElement } from './utils/guards.js';
import { rafThrottle } from './utils/throttle.js';

export type EnableOptions = {
  baseEditingUrl: string;
  environment?: string;
  activate?: 'always' | 'query' | 'localStorage' | ((win: Window) => boolean);
  activationQueryParam?: string;
  activationStorageKey?: string;
  overlays?: 'always' | 'hover' | 'off';
  showBadge?: boolean;
  targetAttribute?: TargetAttribute;
  onResolveUrl?: (info: DecodedInfo) => string | null;
  openInNewTab?: boolean;
  onBeforeOpen?: (url: string, ev: MouseEvent) => boolean | void;
  debug?: boolean;
  persistAfterClean?: boolean;
};

type ResolvedMatch = {
  info: DecodedInfo;
  url: string;
  getRects: () => OverlayBoxes;
  cursorElement: Element | null;
  initialRects?: OverlayBoxes;
  debugNode?: Text | HTMLImageElement;
};

const DEFAULTS = {
  activate: 'query' as const,
  activationQueryParam: 'edit',
  activationStorageKey: 'datocms:ve',
  overlays: 'hover' as const,
  showBadge: true,
  targetAttribute: 'data-datocms-edit-target' as const,
  openInNewTab: true,
  debug: false,
  persistAfterClean: true
};

const FIELD_PATH_ATTR = 'data-datocms-field-path';

function normalizeBaseUrl(url: string): string {
  if (!url) {
    throw new Error('baseEditingUrl is required');
  }

  const trimmed = url.trim();
  const sanitized = trimmed.endsWith('/') ? trimmed.slice(0, -1) : trimmed;
  try {
    const parsed = new URL(sanitized);
    return `${parsed.origin}${parsed.pathname.replace(/\/$/, '')}`;
  } catch (error) {
    throw new Error('baseEditingUrl must be a valid URL');
  }
}

function shouldActivate(win: Window, options: EnableOptions): boolean {
  const mode = options.activate ?? DEFAULTS.activate;
  if (typeof mode === 'function') {
    try {
      return Boolean(mode(win));
    } catch (error) {
      return false;
    }
  }

  if (mode === 'always') {
    return true;
  }

  if (mode === 'query') {
    const param = options.activationQueryParam ?? DEFAULTS.activationQueryParam;
    const search = new URLSearchParams(win.location.search);
    if (!search.has(param)) {
      return false;
    }
    const value = search.get(param);
    if (!value) {
      return true;
    }
    return !['0', 'false', 'off'].includes(value.toLowerCase());
  }

  if (mode === 'localStorage') {
    const key = options.activationStorageKey ?? DEFAULTS.activationStorageKey;
    try {
      const stored = win.localStorage.getItem(key);
      if (!stored) {
        return false;
      }
      return ['1', 'true', 'on'].includes(stored.toLowerCase());
    } catch (error) {
      return false;
    }
  }

  return false;
}

function findFieldPath(element: Element | null): string | null {
  let current: Element | null = element;
  while (current) {
    const value = current.getAttribute(FIELD_PATH_ATTR);
    if (value) {
      const normalized = normalizeFieldPath(value);
      if (normalized) {
        return normalized;
      }
    }
    current = current.parentElement;
  }
  return null;
}

function withFieldPath(info: DecodedInfo, fieldPath: string | null): DecodedInfo {
  if (!fieldPath) {
    return info;
  }
  return {
    ...info,
    fieldPath
  };
}

export function enableDatoVisualEditing(rawOptions: EnableOptions): () => void {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return () => void 0;
  }

  const options = {
    ...DEFAULTS,
    ...rawOptions
  } satisfies EnableOptions & {
    overlays: 'always' | 'hover' | 'off';
    showBadge: boolean;
    targetAttribute: TargetAttribute;
    openInNewTab: boolean;
    debug: boolean;
    persistAfterClean: boolean;
  };

  const baseEditingUrl = normalizeBaseUrl(options.baseEditingUrl);

  if (!shouldActivate(window, options)) {
    return () => void 0;
  }

  const observer = new StegaObserver({
    persistAfterClean: options.persistAfterClean ?? true,
    debug: options.debug ?? DEFAULTS.debug
  });
  observer.start();

  const overlay = new OverlayManager({
    mode: options.overlays ?? DEFAULTS.overlays,
    showBadge: options.showBadge ?? DEFAULTS.showBadge,
    callbacks: {
      onActivate: (event) => {
        if (currentMatch && event instanceof MouseEvent) {
          openDatoLink(currentMatch, event);
        }
      }
    }
  });

  let currentMatch: ResolvedMatch | null = null;
  const cursorMemory = new WeakMap<HTMLElement, string | null>();
  let activeCursorElement: HTMLElement | null = null;

  const updateOverlayPosition = rafThrottle(() => {
    if (!currentMatch) {
      return;
    }
    const rects = currentMatch.getRects();
    if (rects.length) {
      overlay.updateRects(rects);
    } else {
      overlay.hide();
    }
  });

  const onPointerOver = (event: PointerEvent) => {
    const match = resolvePointerMatch(event);
    if (match) {
      setCurrentMatch(match);
    } else {
      clearCurrentMatch();
    }
  };

  const onFocusIn = (event: FocusEvent) => {
    const match = resolveFocusMatch(event.target);
    if (match) {
      setCurrentMatch(match);
    }
  };

  const onFocusOut = (event: FocusEvent) => {
    if (!isElement(event.relatedTarget)) {
      clearCurrentMatch();
    }
  };

  const onClick = (event: MouseEvent) => {
    const match = resolvePointerMatch(event);
    if (!match) {
      return;
    }

    const shouldPrevent = openDatoLink(match, event);
    if (shouldPrevent !== false) {
      event.preventDefault();
    }
  };

  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key !== 'Enter') {
      return;
    }
    const active = document.activeElement;
    if (!isHTMLElement(active)) {
      return;
    }
    const match = resolveFocusMatch(active);
    if (!match) {
      return;
    }
    const shouldPrevent = openDatoLink(match, new MouseEvent('click', { bubbles: true, cancelable: true }));
    if (shouldPrevent !== false) {
      event.preventDefault();
    }
  };

  document.addEventListener('pointerover', onPointerOver, true);
  document.addEventListener('focusin', onFocusIn, true);
  document.addEventListener('focusout', onFocusOut, true);
  document.addEventListener('click', onClick, true);
  document.addEventListener('keydown', onKeyDown, true);
  window.addEventListener('scroll', updateOverlayPosition, true);
  window.addEventListener('resize', updateOverlayPosition, true);

  function resolvePointerMatch(event: PointerEvent | MouseEvent): ResolvedMatch | null {
    const target = event.target;

    if (isElement(target)) {
      const imageMatch = observer.getImageMatch(target);
      if (imageMatch) {
        const resolved = createImageMatch(imageMatch);
        if (resolved) {
          return resolved;
        }
      }
    }

    if (Number.isFinite(event.clientX) && Number.isFinite(event.clientY)) {
      return resolveTextMatchAtPoint(event.clientX, event.clientY);
    }

    return null;
  }

  function resolveFocusMatch(target: EventTarget | null): ResolvedMatch | null {
    if (!isElement(target)) {
      return null;
    }

    const imageMatch = observer.getImageMatch(target);
    if (imageMatch) {
      return createImageMatch(imageMatch);
    }

    const candidates = observer.getTextMatchesWithin(target);
    for (const candidate of candidates) {
      const rects = rectsForTextNode(candidate.node);
      if (rects.length) {
        return createTextMatch(candidate, rects);
      }
    }

    return null;
  }

  function resolveTextMatchAtPoint(clientX: number, clientY: number): ResolvedMatch | null {
    if (!Number.isFinite(clientX) || !Number.isFinite(clientY)) {
      return null;
    }

    const elements = typeof document.elementsFromPoint === 'function'
      ? document.elementsFromPoint(clientX, clientY)
      : [];

    if (!elements.length) {
      return null;
    }

    const pageX = clientX + window.scrollX;
    const pageY = clientY + window.scrollY;

    for (const element of elements) {
      if (!(element instanceof Element)) {
        continue;
      }
      const matches = observer.getTextMatchesWithin(element);
      if (!matches.length) {
        continue;
      }
      for (const match of matches) {
        const rects = rectsForTextNode(match.node);
        if (!rects.length) {
          continue;
        }
        if (rects.some((rect) => pointInBox(pageX, pageY, rect))) {
          return createTextMatch(match, rects);
        }
      }
    }

    return null;
  }

  function createTextMatch(match: TextStegaMatch, initialRects?: OverlayBoxes): ResolvedMatch | null {
    const parent = match.node.parentElement;
    const targetAttr = options.targetAttribute ?? DEFAULTS.targetAttribute;
    const highlightContainer = parent ? resolveHighlightContainer(parent, targetAttr) : null;
    const fieldPath = findFieldPath(highlightContainer ?? parent);
    const infoWithField = withFieldPath(match.info, fieldPath);
    const url = resolveUrl(infoWithField);
    if (!url) {
      return null;
    }

    const getRects = () => rectsForTextNode(match.node);

    return {
      info: infoWithField,
      url,
      getRects,
      cursorElement: parent,
      initialRects,
      debugNode: match.node
    };
  }

  function createImageMatch(match: ImageStegaMatch): ResolvedMatch | null {
    const element = match.element;
    const fieldPath = findFieldPath(element);
    const infoWithField = withFieldPath(match.info, fieldPath);
    const url = resolveUrl(infoWithField);
    if (!url) {
      return null;
    }

    const getRects = () => {
      const box = measureElement(element);
      return box ? [box] : [];
    };

    const initialRects = getRects();

    return {
      info: infoWithField,
      url,
      getRects,
      cursorElement: element,
      initialRects,
      debugNode: element instanceof HTMLImageElement ? element : undefined
    };
  }

  function resolveUrl(info: DecodedInfo): string | null {
    if (options.onResolveUrl) {
      const custom = options.onResolveUrl(info);
      if (custom === null) {
        return null;
      }
      if (typeof custom === 'string' && custom.length > 0) {
        return custom;
      }
    }

    try {
      return buildDatoDeepLink(info, baseEditingUrl, options.environment);
    } catch (error) {
      if (info.editUrl) {
        return info.editUrl;
      }
      return null;
    }
  }

  function applyPointerCursor(element: Element): void {
    if (!isHTMLElement(element)) {
      return;
    }
    if (activeCursorElement === element) {
      return;
    }
    restorePointerCursor();
    activeCursorElement = element;
    if (!cursorMemory.has(element)) {
      cursorMemory.set(element, element.style.cursor || null);
    }
    element.style.cursor = 'pointer';
  }

  function restorePointerCursor(): void {
    if (!activeCursorElement) {
      return;
    }
    const previous = cursorMemory.get(activeCursorElement);
    if (previous === undefined || previous === null || previous === '') {
      activeCursorElement.style.removeProperty('cursor');
    } else {
      activeCursorElement.style.cursor = previous;
    }
    activeCursorElement = null;
  }

  function setCurrentMatch(match: ResolvedMatch): void {
    currentMatch = match;
    if (match.cursorElement) {
      applyPointerCursor(match.cursorElement);
    } else {
      restorePointerCursor();
    }

    const rects = match.initialRects && match.initialRects.length ? match.initialRects : match.getRects();
    if (rects.length) {
      overlay.highlightRects(rects);
    } else {
      overlay.hide();
    }
  }

  function clearCurrentMatch(): void {
    currentMatch = null;
    overlay.hide();
    restorePointerCursor();
  }

  function openDatoLink(match: ResolvedMatch, event: MouseEvent): boolean | void {
    if (options.debug) {
      console.log('[datocms-visual-editing][debug] overlay click', {
        eventType: event.type,
        url: match.url,
        info: match.info,
        element: match.cursorElement ?? match.debugNode ?? null
      });
    }

    const proceed = options.onBeforeOpen ? options.onBeforeOpen(match.url, event) : undefined;
    if (proceed === false) {
      return false;
    }

    if (options.openInNewTab ?? DEFAULTS.openInNewTab) {
      window.open(match.url, '_blank', 'noopener');
    } else {
      window.open(match.url, '_self');
    }
    return true;
  }

  const dispose = () => {
    observer.stop();
    overlay.dispose();
    restorePointerCursor();
    updateOverlayPosition.cancel();
    document.removeEventListener('pointerover', onPointerOver, true);
    document.removeEventListener('focusin', onFocusIn, true);
    document.removeEventListener('focusout', onFocusOut, true);
    document.removeEventListener('click', onClick, true);
    document.removeEventListener('keydown', onKeyDown, true);
    window.removeEventListener('scroll', updateOverlayPosition, true);
    window.removeEventListener('resize', updateOverlayPosition, true);
  };

  return dispose;
}
