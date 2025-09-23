export type OverlayBox = {
  top: number;
  left: number;
  width: number;
  height: number;
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
