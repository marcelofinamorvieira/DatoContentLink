import { OverlayBox } from './measure.js';
import { rafThrottle } from '../utils/throttle.js';

type OverlayMode = 'hover' | 'always' | 'off';

type OverlayCallbacks = {
  onActivate: (event: MouseEvent | KeyboardEvent) => void;
};

type OverlayOptions = {
  mode: OverlayMode;
  showBadge: boolean;
  callbacks: OverlayCallbacks;
};

const BADGE_LABEL = 'Open in DatoCMS';

function prefersReducedMotion(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export class OverlayManager {
  private readonly mode: OverlayMode;
  private readonly showBadge: boolean;
  private readonly callbacks: OverlayCallbacks;
  private root: HTMLDivElement | null = null;
  private outline: HTMLDivElement | null = null;
  private isVisible = false;
  private lastBox: OverlayBox | null = null;
  private rafUpdater = rafThrottle((box: OverlayBox) => this.updateStyles(box));

  constructor(options: OverlayOptions) {
    this.mode = options.mode;
    this.showBadge = options.showBadge;
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

    const outline = document.createElement('div');
    outline.setAttribute('role', 'presentation');
    outline.style.position = 'absolute';
    outline.style.borderRadius = '8px';
    outline.style.border = '2px solid #ff7751';
    outline.style.boxSizing = 'border-box';
    outline.style.background = 'rgba(255,119,81,0.12)';
    outline.style.pointerEvents = 'none';
    if (!prefersReducedMotion()) {
      outline.style.transition = 'transform 120ms ease, width 120ms ease, height 120ms ease, opacity 120ms ease';
    }

    root.appendChild(outline);

    if (this.showBadge) {
      const badge = document.createElement('button');
      badge.type = 'button';
      badge.textContent = BADGE_LABEL;
      badge.setAttribute('aria-label', BADGE_LABEL);
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
      badge.style.pointerEvents = 'auto';

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
    }

    document.body.appendChild(root);
    this.root = root;
    this.outline = outline;
  }

  highlight(box: OverlayBox): void {
    if (this.mode === 'off') {
      return;
    }
    this.ensureDom();
    if (!this.root || !this.outline) {
      return;
    }

    this.isVisible = true;
    this.root.style.display = 'block';
    this.rafUpdater(box);
  }

  hide(): void {
    if (this.mode === 'off') {
      return;
    }
    this.rafUpdater.cancel();
    if (this.root) {
      if (this.mode === 'hover') {
        this.root.style.display = 'none';
        this.isVisible = false;
      }
    }
  }

  isActive(): boolean {
    return this.isVisible;
  }

  update(box: OverlayBox): void {
    if (this.mode === 'off') {
      return;
    }
    if (!this.isVisible) {
      return;
    }
    this.rafUpdater(box);
  }

  dispose(): void {
    this.rafUpdater.cancel();
    if (this.root) {
      this.root.remove();
    }
    this.root = null;
    this.outline = null;
    this.isVisible = false;
    this.lastBox = null;
  }

  private updateStyles(box: OverlayBox): void {
    if (!this.root || !this.outline) {
      return;
    }
    if (this.lastBox &&
      this.lastBox.top === box.top &&
      this.lastBox.left === box.left &&
      this.lastBox.width === box.width &&
      this.lastBox.height === box.height) {
      return;
    }

    this.lastBox = box;
    this.root.style.transform = `translate(${box.left}px, ${box.top}px)`;
    this.outline.style.width = `${Math.max(0, box.width)}px`;
    this.outline.style.height = `${Math.max(0, box.height)}px`;
  }
}
