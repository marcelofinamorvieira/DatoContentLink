export type OverlayBox = {
  top: number;
  left: number;
  width: number;
  height: number;
};

export type OverlayBoxes = OverlayBox[];

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
