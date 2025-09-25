export type OverlayBox = {
  top: number;
  left: number;
  width: number;
  height: number;
};

export type OverlayBoxes = OverlayBox[];

// Padding/min-size helpers keep hover targets forgiving without mutating DOM styles.
export type EdgePadding =
  | number
  | {
      x?: number;
      y?: number;
      top?: number;
      right?: number;
      bottom?: number;
      left?: number;
    };

function toOverlayBox(rect: DOMRect): OverlayBox {
  return {
    top: rect.top + window.scrollY,
    left: rect.left + window.scrollX,
    width: rect.width,
    height: rect.height
  };
}

export function measureElement(target: Element): OverlayBox | null {
  const rect = target.getBoundingClientRect();

  if (rect.width === 0 && rect.height === 0) {
    const fallback = target.parentElement;
    if (fallback) {
      return measureElement(fallback);
    }
    return null;
  }

  return toOverlayBox(rect);
}

export function elementAreaRatio(el: Element): number {
  const rect = el.getBoundingClientRect();
  const area = Math.max(0, rect.width) * Math.max(0, rect.height);
  const viewportArea = Math.max(1, window.innerWidth * window.innerHeight);
  return area / viewportArea;
}

export function rectsForTextNode(node: Text): OverlayBoxes {
  const range = document.createRange();
  range.selectNodeContents(node);
  const rects: OverlayBoxes = [];
  for (const rect of Array.from(range.getClientRects())) {
    if (rect.width > 0 && rect.height > 0) {
      rects.push(toOverlayBox(rect));
    }
  }
  return rects;
}

export function unionBox(rects: OverlayBoxes): OverlayBox | null {
  if (!rects.length) {
    return null;
  }
  let top = Infinity;
  let left = Infinity;
  let right = -Infinity;
  let bottom = -Infinity;
  for (const rect of rects) {
    top = Math.min(top, rect.top);
    left = Math.min(left, rect.left);
    right = Math.max(right, rect.left + rect.width);
    bottom = Math.max(bottom, rect.top + rect.height);
  }
  return {
    top,
    left,
    width: Math.max(0, right - left),
    height: Math.max(0, bottom - top)
  };
}

export function pointInBox(x: number, y: number, box: OverlayBox): boolean {
  return x >= box.left && x <= box.left + box.width && y >= box.top && y <= box.top + box.height;
}

function normalizePadding(padding: EdgePadding): { top: number; right: number; bottom: number; left: number } {
  if (typeof padding === 'number') {
    const value = Math.max(0, padding);
    return { top: value, right: value, bottom: value, left: value };
  }

  const x = Math.max(0, padding.x ?? 0);
  const y = Math.max(0, padding.y ?? 0);
  return {
    top: Math.max(0, padding.top ?? y),
    right: Math.max(0, padding.right ?? x),
    bottom: Math.max(0, padding.bottom ?? y),
    left: Math.max(0, padding.left ?? x)
  };
}

export function inflateBox(box: OverlayBox, padding: EdgePadding): OverlayBox {
  // Expand both axes so near-miss hovers still register as intentional.
  const { top, right, bottom, left } = normalizePadding(padding);
  return {
    top: box.top - top,
    left: box.left - left,
    width: Math.max(0, box.width + left + right),
    height: Math.max(0, box.height + top + bottom)
  };
}

export function inflateBoxes(rects: OverlayBoxes, padding: EdgePadding): OverlayBoxes {
  if (!rects.length) {
    return rects;
  }
  return rects.map((rect) => inflateBox(rect, padding));
}

export function ensureMinSize(box: OverlayBox, width: number, height = width): OverlayBox {
  // Guarantee a minimum hit size (useful for short glyph runs on large screens).
  const normalizedWidth = Math.max(0, width);
  const normalizedHeight = Math.max(0, height);
  if (normalizedWidth === 0 && normalizedHeight === 0) {
    return box;
  }

  const deltaWidth = Math.max(0, normalizedWidth - box.width);
  const deltaHeight = Math.max(0, normalizedHeight - box.height);

  if (deltaWidth === 0 && deltaHeight === 0) {
    return box;
  }

  return {
    top: box.top - deltaHeight / 2,
    left: box.left - deltaWidth / 2,
    width: box.width + deltaWidth,
    height: box.height + deltaHeight
  };
}

export function ensureMinSizeForBoxes(rects: OverlayBoxes, width: number, height = width): OverlayBoxes {
  if (!rects.length) {
    return rects;
  }
  return rects.map((rect) => ensureMinSize(rect, width, height));
}
