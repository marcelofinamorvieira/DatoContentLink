import { StegaObserver, type TextStegaMatch, type ImageStegaMatch, type ExplicitStegaMatch } from './dom/observer.js';
import { OverlayManager } from './dom/overlays.js';
import {
  measureElement,
  rectsForTextNode,
  pointInBox,
  inflateBoxes,
  ensureMinSizeForBoxes,
  mergeBoxes,
  type OverlayBoxes,
  type EdgePadding
} from './dom/measure.js';
import { buildDatoDeepLink } from './link/buildDatoDeepLink.js';
import { normalizeFieldPath } from './link/fieldPath.js';
import { DecodedInfo } from './decode/types.js';
import {
  resolveHighlightContainer,
  hasDatoTarget,
  TargetAttribute,
  FIELD_PATH_ATTR
} from './utils/attr.js';
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
  /**
   * Leave this enabled (default) and pair with AutoClean so overlays remain clickable
   * after the hidden stega markers are scrubbed from the DOM.
   */
  persistAfterClean?: boolean;
  // Interaction tuning knobs so overlays match the mental “card” target.
  hitPadding?: EdgePadding;
  minHitSize?: number | { width: number; height?: number };
  hoverLingerMs?: number;
  mergeSegments?: 'proximity' | 'always' | 'never';
  mergeProximity?: EdgePadding;
};

type ResolvedMatch = {
  info: DecodedInfo;
  url: string;
  getRects: () => OverlayBoxes;
  cursorElement: Element | null;
  initialRects?: OverlayBoxes;
  debugNode?: Element | Text;
};

type TextMatchContext = {
  rects: OverlayBoxes;
  cursorElement: Element | null;
  fieldPathElement: Element | null;
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
  persistAfterClean: true,
  hitPadding: 8 as EdgePadding,
  minHitSize: 0,
  hoverLingerMs: 100,
  mergeSegments: 'proximity' as const,
  mergeProximity: 6 as EdgePadding
};

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
    hitPadding: EdgePadding;
    minHitSize: number | { width: number; height?: number };
    hoverLingerMs: number;
    mergeSegments: 'proximity' | 'always' | 'never';
    mergeProximity: EdgePadding;
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
        if (!currentMatch) {
          return;
        }
        const mouseEvent = toMouseEvent(event);
        const shouldPrevent = openDatoLink(currentMatch, mouseEvent);
        if (shouldPrevent !== false) {
          if (event instanceof Event) {
            event.preventDefault();
            event.stopPropagation();
          }
        }
      }
    }
  });

  let currentMatch: ResolvedMatch | null = null;
  const cursorMemory = new WeakMap<HTMLElement, string | null>();
  let activeCursorElement: HTMLElement | null = null;
  // Short hover linger prevents flicker when the pointer skims padded edges.
  const hoverLingerDelay = Math.max(0, options.hoverLingerMs ?? 0);
  let hoverClearTimer: number | null = null;

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

  // Re-evaluate matches on pointer move so overlays appear while gliding inside a card.
  const updateMatchFromMove = rafThrottle((event: PointerEvent) => {
    const match = resolvePointerMatch(event);
    if (match) {
      cancelHoverClear();
      setCurrentMatch(match);
    } else {
      scheduleHoverClear();
    }
  });

  const onPointerOver = (event: PointerEvent) => {
    if (event.pointerType === 'touch') {
      return;
    }
    const match = resolvePointerMatch(event);
    if (match) {
      cancelHoverClear();
      setCurrentMatch(match);
    } else {
      scheduleHoverClear();
    }
  };

  const onPointerMove = (event: PointerEvent) => {
    if (event.pointerType === 'touch') {
      return;
    }
    updateMatchFromMove(event);
  };

  const onFocusIn = (event: FocusEvent) => {
    const match = resolveFocusMatch(event.target);
    if (match) {
      cancelHoverClear();
      setCurrentMatch(match);
    }
  };

  const onFocusOut = (event: FocusEvent) => {
    if (!isElement(event.relatedTarget)) {
      cancelHoverClear();
      clearCurrentMatch();
    }
  };

  const onClick = (event: MouseEvent) => {
    const match = resolvePointerMatch(event);
    if (!match) {
      return;
    }

    cancelHoverClear();
    setCurrentMatch(match);

    const shouldPrevent = openDatoLink(match, event);
    if (shouldPrevent !== false) {
      event.preventDefault();
    }
  };

  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key !== 'Enter' && event.key !== ' ' && event.key !== 'Spacebar') {
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

    cancelHoverClear();
    setCurrentMatch(match);

    const syntheticClick = toMouseEvent(event);
    const shouldPrevent = openDatoLink(match, syntheticClick);
    if (shouldPrevent !== false) {
      event.preventDefault();
    }
  };

  document.addEventListener('pointerover', onPointerOver, true);
  document.addEventListener('pointermove', onPointerMove, true);
  document.addEventListener('focusin', onFocusIn, true);
  document.addEventListener('focusout', onFocusOut, true);
  document.addEventListener('click', onClick, true);
  document.addEventListener('keydown', onKeyDown, true);
  window.addEventListener('scroll', updateOverlayPosition, true);
  window.addEventListener('resize', updateOverlayPosition, true);

  function resolvePointerMatch(event: PointerEvent | MouseEvent): ResolvedMatch | null {
    const target = event.target;
    const origin = isElement(target) ? target : null;

    if (origin) {
      const explicitMatch = observer.getExplicitMatch(origin);
      if (explicitMatch) {
        const resolvedExplicit = createExplicitMatch(explicitMatch);
        if (resolvedExplicit) {
          return resolvedExplicit;
        }
      }
      const imageMatch = observer.getImageMatch(origin);
      if (imageMatch) {
        const resolved = createImageMatch(imageMatch);
        if (resolved) {
          return resolved;
        }
      }
    }

    if (Number.isFinite(event.clientX) && Number.isFinite(event.clientY)) {
      const explicitAtPoint = resolveExplicitMatchAtPoint(event.clientX, event.clientY);
      if (explicitAtPoint) {
        return explicitAtPoint;
      }
      const imgAtPoint = resolveImageMatchAtPoint(event.clientX, event.clientY);
      if (imgAtPoint) {
        return imgAtPoint;
      }

      const textAtPoint = resolveTextMatchAtPoint(event.clientX, event.clientY);
      if (textAtPoint) {
        return textAtPoint;
      }
    }

    return null;
  }

  function resolveExplicitMatchAtPoint(clientX: number, clientY: number): ResolvedMatch | null {
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

      const direct = observer.getExplicitMatch(element);
      if (direct) {
        const resolved = createExplicitMatch(direct);
        if (resolved && resolved.getRects().some((rect) => pointInBox(pageX, pageY, rect))) {
          return resolved;
        }
      }

      const descendants = observer.getExplicitMatchesWithin(element);
      for (const candidate of descendants) {
        const resolved = createExplicitMatch(candidate);
        if (resolved && resolved.getRects().some((rect) => pointInBox(pageX, pageY, rect))) {
          return resolved;
        }
      }
    }

    return null;
  }

  function resolveImageMatchAtPoint(clientX: number, clientY: number): ResolvedMatch | null {
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

      const directMatch = observer.getImageMatch(element);
      if (directMatch) {
        const resolved = createImageMatch(directMatch);
        if (resolved && resolved.getRects().some((rect) => pointInBox(pageX, pageY, rect))) {
          return resolved;
        }
      }

      const descendantMatches = observer.getImageMatchesWithin(element);
      for (const candidate of descendantMatches) {
        const resolved = createImageMatch(candidate);
        if (resolved && resolved.getRects().some((rect) => pointInBox(pageX, pageY, rect))) {
          return resolved;
        }
      }
    }

    return null;
  }

  function resolveFocusMatch(target: EventTarget | null): ResolvedMatch | null {
    if (!isElement(target)) {
      return null;
    }

    const explicitMatch = observer.getExplicitMatch(target);
    if (explicitMatch) {
      const resolved = createExplicitMatch(explicitMatch);
      if (resolved) {
        return resolved;
      }
    }

    const imageMatch = observer.getImageMatch(target);
    if (imageMatch) {
      const resolved = createImageMatch(imageMatch);
      return resolved ?? null;
    }

    const candidates = observer.getTextMatchesWithin(target);
    for (const candidate of candidates) {
      const context = computeTextMatchContext(candidate);
      if (context.rects.length) {
        const resolved = createTextMatch(candidate, context);
        if (resolved) {
          return resolved;
        }
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
        const context = computeTextMatchContext(match);
        if (!context.rects.length) {
          continue;
        }
        if (context.rects.some((rect) => pointInBox(pageX, pageY, rect))) {
          return createTextMatch(match, context);
        }
      }
    }

    return null;
  }

  function createTextMatch(match: TextStegaMatch, context?: TextMatchContext): ResolvedMatch | null {
    const ctx = context ?? computeTextMatchContext(match);
    if (!ctx.rects.length) {
      return null;
    }

    const fieldPathElement = ctx.fieldPathElement ?? ctx.cursorElement ?? match.node.parentElement;
    const fieldPath = findFieldPath(fieldPathElement ?? null) ?? findFieldPath(match.node.parentElement);
    const infoWithField = withFieldPath(match.info, fieldPath);
    const url = resolveUrl(infoWithField);
    if (!url) {
      return null;
    }

    const getRects = () => computeTextMatchContext(match).rects;

    return {
      info: infoWithField,
      url,
      getRects,
      cursorElement: ctx.cursorElement ?? match.node.parentElement,
      initialRects: ctx.rects,
      debugNode: match.node
    };
  }

  function createExplicitMatch(match: ExplicitStegaMatch): ResolvedMatch | null {
    const element = match.element;
    const targetAttr = options.targetAttribute ?? DEFAULTS.targetAttribute;
    const highlightContainer = resolveHighlightContainer(element, targetAttr);
    const containerIsTarget = highlightContainer && hasDatoTarget(highlightContainer);
    const fieldPathElement = containerIsTarget ? highlightContainer : element;
    const fieldPath = findFieldPath(fieldPathElement) ?? findFieldPath(element);
    const infoWithField = withFieldPath(match.info, fieldPath);
    const url = resolveUrl(infoWithField);
    if (!url) {
      return null;
    }

    const getRects = () => {
      const measurementElement = containerIsTarget ? highlightContainer! : element;
      const box = measureElement(measurementElement);
      return transformRects(box ? [box] : []);
    };

    const initialRects = getRects();

    return {
      info: infoWithField,
      url,
      getRects,
      cursorElement: containerIsTarget ? highlightContainer : element,
      initialRects,
      debugNode: element
    };
  }

  function createImageMatch(match: ImageStegaMatch): ResolvedMatch | null {
    const element = match.element;
    const targetAttr = options.targetAttribute ?? DEFAULTS.targetAttribute;
    const highlightContainer = resolveHighlightContainer(element, targetAttr);
    const containerIsTarget = highlightContainer && hasDatoTarget(highlightContainer);
    const fieldPath = findFieldPath(containerIsTarget ? highlightContainer : element) ?? findFieldPath(element);
    const infoWithField = withFieldPath(match.info, fieldPath);
    const url = resolveUrl(infoWithField);
    if (!url) {
      return null;
    }

    const getRects = () => {
      if (containerIsTarget) {
        const containerBox = measureElement(highlightContainer!);
        if (containerBox) {
          return transformRects([containerBox]);
        }
      }
      const box = measureElement(element);
      const rects = box ? [box] : [];
      return transformRects(rects);
    };

    const initialRects = getRects();

    return {
      info: infoWithField,
      url,
      getRects,
      cursorElement: containerIsTarget ? highlightContainer : element,
      initialRects,
      debugNode: element instanceof HTMLImageElement ? element : undefined
    };
  }

  function normalizeMinHitSizeOption(value: number | { width: number; height?: number }): { width: number; height: number } {
    if (typeof value === 'number') {
      const size = Math.max(0, value);
      return { width: size, height: size };
    }
    const width = Math.max(0, value.width ?? 0);
    const height = Math.max(0, value.height ?? width);
    return { width, height };
  }

  function transformRects(rects: OverlayBoxes): OverlayBoxes {
    if (!rects.length) {
      return rects;
    }

    // Inflate and normalize geometry so hover/click targets match “card” intent, not raw glyph ink.
    let transformed = inflateBoxes(rects, options.hitPadding);
    const minSize = normalizeMinHitSizeOption(options.minHitSize);
    if (minSize.width > 0 || minSize.height > 0) {
      transformed = ensureMinSizeForBoxes(transformed, minSize.width, minSize.height);
    }
    // Coalesce overlapping lines/segments into a single clean overlay when desired.
    transformed = mergeBoxes(
      transformed,
      options.mergeSegments ?? DEFAULTS.mergeSegments,
      options.mergeProximity ?? DEFAULTS.mergeProximity
    );
    return transformed;
  }

  function computeTextMatchContext(match: TextStegaMatch): TextMatchContext {
    const parent = match.node.parentElement;
    const targetAttr = options.targetAttribute ?? DEFAULTS.targetAttribute;
    const highlightContainer = parent ? resolveHighlightContainer(parent, targetAttr) : null;

    let rects: OverlayBoxes = [];
    let cursorElement: Element | null = parent;
    let fieldPathElement: Element | null = highlightContainer ?? parent;

    if (highlightContainer && hasDatoTarget(highlightContainer)) {
      const containerBox = measureElement(highlightContainer);
      if (containerBox) {
        rects = [containerBox];
        cursorElement = highlightContainer;
        fieldPathElement = highlightContainer;
        // Prefer container geometry when authors opt in via data attribute.
      }
    }

    if (!rects.length) {
      rects = rectsForTextNode(match.node);
    }

    rects = transformRects(rects);

    return {
      rects,
      cursorElement,
      fieldPathElement
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
    cancelHoverClear();
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
    cancelHoverClear();
    performClear();
  }

  function performClear(): void {
    currentMatch = null;
    overlay.hide();
    restorePointerCursor();
  }

  function scheduleHoverClear(): void {
    if (!currentMatch) {
      return;
    }
    if (hoverLingerDelay === 0) {
      performClear();
      return;
    }
    cancelHoverClear();
    hoverClearTimer = window.setTimeout(() => {
      hoverClearTimer = null;
      performClear();
    }, hoverLingerDelay);
  }

  function cancelHoverClear(): void {
    if (hoverClearTimer != null) {
      clearTimeout(hoverClearTimer);
      hoverClearTimer = null;
    }
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

  function toMouseEvent(event: MouseEvent | KeyboardEvent): MouseEvent {
    if (event instanceof MouseEvent) {
      return event;
    }

    return new MouseEvent('click', {
      bubbles: true,
      cancelable: true,
      altKey: event.altKey,
      ctrlKey: event.ctrlKey,
      metaKey: event.metaKey,
      shiftKey: event.shiftKey
    });
  }

  const dispose = () => {
    observer.stop();
    overlay.dispose();
    restorePointerCursor();
    updateOverlayPosition.cancel();
    document.removeEventListener('pointerover', onPointerOver, true);
    document.removeEventListener('pointermove', onPointerMove, true);
    document.removeEventListener('focusin', onFocusIn, true);
    document.removeEventListener('focusout', onFocusOut, true);
    document.removeEventListener('click', onClick, true);
    document.removeEventListener('keydown', onKeyDown, true);
    window.removeEventListener('scroll', updateOverlayPosition, true);
    window.removeEventListener('resize', updateOverlayPosition, true);
    updateMatchFromMove.cancel();
    cancelHoverClear();
  };

  return dispose;
}
