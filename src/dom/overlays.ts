import { OverlayBox, OverlayBoxes, unionBox } from './measure.js';
import { rafThrottle } from '../utils/throttle.js';

type OverlayMode = 'hover' | 'always' | 'off';

type OverlayCallbacks = {
  onActivate: (event: MouseEvent | KeyboardEvent) => void;
};

type OverlayOptions = {
  mode: OverlayMode;
  showBadge: boolean;
  badgeLabel?: string;
  callbacks: OverlayCallbacks;
};

const DEFAULT_BADGE_LABEL = 'Open in DatoCMS';

function prefersReducedMotion(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export class OverlayManager {
  private readonly mode: OverlayMode;
  private readonly showBadge: boolean;
  private readonly badgeLabel: string;
  private readonly callbacks: OverlayCallbacks;
  private root: HTMLDivElement | null = null;
  private segmentsRoot: HTMLDivElement | null = null;
  private badge: HTMLButtonElement | null = null;
  private segments: HTMLDivElement[] = [];
  private isVisible = false;
  private lastSignature: string | null = null;
  private rafUpdater = rafThrottle((rects: OverlayBoxes) => this.render(rects));

  constructor(options: OverlayOptions) {
    this.mode = options.mode;
    this.showBadge = options.showBadge;
    this.badgeLabel = options.badgeLabel ?? DEFAULT_BADGE_LABEL;
    this.callbacks = options.callbacks;
  }

  private ensureDom(): void {
    if (this.root) {
      return;
    }

    const root = document.createElement('div');
    root.style.position = 'absolute';
    root.style.top = '0';
    root.style.left = '0';
    root.style.zIndex = '2147483646';
    root.style.pointerEvents = 'none';
    root.style.display = 'none';
    root.setAttribute('aria-live', 'polite');
    root.setAttribute('role', 'region');
    root.setAttribute('aria-label', 'DatoCMS visual editing overlays');
    root.tabIndex = -1;

    const segmentsRoot = document.createElement('div');
    segmentsRoot.style.position = 'absolute';
    segmentsRoot.style.top = '0';
    segmentsRoot.style.left = '0';
    segmentsRoot.style.pointerEvents = 'none';
    segmentsRoot.setAttribute('aria-hidden', 'true');
    root.appendChild(segmentsRoot);

    if (this.showBadge) {
      const badge = document.createElement('button');
      badge.type = 'button';
      badge.textContent = this.badgeLabel;
      badge.setAttribute('aria-label', this.badgeLabel);
      badge.style.position = 'absolute';
      badge.style.top = '0';
      badge.style.right = '0';
      badge.style.transform = 'translate(50%, -50%)';
      badge.style.pointerEvents = 'auto';
      badge.style.fontSize = '11px';
      badge.style.fontWeight = '600';
      badge.style.padding = '4px 8px';
      badge.style.borderRadius = '999px';
      badge.style.border = 'none';
      badge.style.background = '#ff7751';
      badge.style.color = '#ffffff';
      badge.style.boxShadow = '0 2px 6px rgba(0,0,0,0.2)';
      badge.style.cursor = 'pointer';

      badge.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();
        this.callbacks.onActivate(event);
      });

      badge.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          this.callbacks.onActivate(event);
        }
      });

      root.appendChild(badge);
      this.badge = badge;
    }

    document.body.appendChild(root);
    this.root = root;
    this.segmentsRoot = segmentsRoot;
  }

  highlight(box: OverlayBox): void {
    this.highlightRects([box]);
  }

  highlightRects(rects: OverlayBoxes): void {
    if (this.mode === 'off') {
      return;
    }
    this.ensureDom();
    if (!this.root || !this.segmentsRoot) {
      return;
    }

    if (!rects.length) {
      this.hide();
      return;
    }

    this.isVisible = true;
    this.root.style.display = 'block';
    this.rafUpdater(rects);
  }

  hide(): void {
    if (this.mode === 'off') {
      return;
    }
    this.rafUpdater.cancel();
    if (this.root && this.mode === 'hover') {
      this.root.style.display = 'none';
    }
    this.isVisible = false;
  }

  isActive(): boolean {
    return this.isVisible;
  }

  update(box: OverlayBox): void {
    this.updateRects([box]);
  }

  updateRects(rects: OverlayBoxes): void {
    if (this.mode === 'off' || !this.isVisible) {
      return;
    }
    this.rafUpdater(rects);
  }

  dispose(): void {
    this.rafUpdater.cancel();
    if (this.root) {
      this.root.remove();
    }
    this.root = null;
    this.segmentsRoot = null;
    this.badge = null;
    this.segments = [];
    this.isVisible = false;
    this.lastSignature = null;
  }

  private ensureSegmentCount(count: number): void {
    if (!this.segmentsRoot) {
      return;
    }
    while (this.segments.length < count) {
      const segment = document.createElement('div');
      segment.setAttribute('role', 'presentation');
      segment.setAttribute('aria-hidden', 'true');
      segment.style.position = 'absolute';
      segment.style.borderRadius = '8px';
      segment.style.border = '2px solid #ff7751';
      segment.style.boxSizing = 'border-box';
      segment.style.background = 'rgba(255,119,81,0.12)';
      segment.style.pointerEvents = 'none';
      if (!prefersReducedMotion()) {
        segment.style.transition = 'transform 120ms ease, width 120ms ease, height 120ms ease, opacity 120ms ease';
      }
      this.segmentsRoot.appendChild(segment);
      this.segments.push(segment);
    }
  }

  private render(rects: OverlayBoxes): void {
    if (!this.root || !this.segmentsRoot) {
      return;
    }

    const union = unionBox(rects);
    if (!union) {
      this.hide();
      return;
    }

    const signature = rects.map((rect) => `${rect.top}:${rect.left}:${rect.width}:${rect.height}`).join('|');
    if (this.lastSignature === signature) {
      return;
    }
    this.lastSignature = signature;

    this.root.style.transform = `translate(${union.left}px, ${union.top}px)`;
    this.root.style.width = `${Math.max(0, union.width)}px`;
    this.root.style.height = `${Math.max(0, union.height)}px`;

    const relativeRects = rects.map((rect) => ({
      top: rect.top - union.top,
      left: rect.left - union.left,
      width: rect.width,
      height: rect.height
    }));

    this.ensureSegmentCount(relativeRects.length);

    for (let index = 0; index < this.segments.length; index += 1) {
      const segment = this.segments[index];
      const rect = relativeRects[index];
      if (rect) {
        segment.style.display = 'block';
        segment.style.top = `${rect.top}px`;
        segment.style.left = `${rect.left}px`;
        segment.style.width = `${Math.max(0, rect.width)}px`;
        segment.style.height = `${Math.max(0, rect.height)}px`;
      } else {
        segment.style.display = 'none';
      }
    }
  }

  releaseFocus(): void {
    if (this.badge && document.activeElement === this.badge) {
      this.badge.blur();
    }
    if (
      this.root &&
      document.activeElement instanceof HTMLElement &&
      this.root.contains(document.activeElement)
    ) {
      document.activeElement.blur();
    }
  }
}
