import { OverlayBox, OverlayBoxes, unionBox } from './measure.js';
import { rafThrottle } from '../utils/throttle.js';

type OverlayMode = 'hover' | 'always' | 'off';

type OverlayCallbacks = {
  onActivate: (event: MouseEvent | KeyboardEvent) => void;
  onChoose?: (choice: 'edit' | 'follow', event: MouseEvent | KeyboardEvent) => void;
  onCloseChooser?: () => void;
};

type OverlayOptions = {
  mode: OverlayMode;
  showBadge: boolean;
  callbacks: OverlayCallbacks;
};

const BADGE_LABEL = 'Open in DatoCMS';
const DEFAULT_FOLLOW_LABEL = 'Follow click';

function prefersReducedMotion(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export class OverlayManager {
  private readonly mode: OverlayMode;
  private readonly showBadge: boolean;
  private readonly callbacks: OverlayCallbacks;
  private root: HTMLDivElement | null = null;
  private segmentsRoot: HTMLDivElement | null = null;
  private segments: HTMLDivElement[] = [];
  private badge: HTMLButtonElement | null = null;
  private chooserRoot: HTMLDivElement | null = null;
  private chooserEditButton: HTMLButtonElement | null = null;
  private chooserFollowButton: HTMLButtonElement | null = null;
  private chooserOpen = false;
  private previousFocus: HTMLElement | null = null;
  private handleChooserKeyDown = (event: KeyboardEvent) => {
    if (!this.chooserOpen) {
      return;
    }

    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      this.hideChooser();
      return;
    }

    if (event.key === 'Tab') {
      if (!this.chooserEditButton || !this.chooserFollowButton) {
        return;
      }

      const buttons = [this.chooserEditButton, this.chooserFollowButton];
      const active = document.activeElement;
      const currentIndex = buttons.indexOf(active as HTMLButtonElement);
      let nextIndex = currentIndex;

      if (event.shiftKey) {
        nextIndex = currentIndex <= 0 ? buttons.length - 1 : currentIndex - 1;
      } else {
        nextIndex = currentIndex >= buttons.length - 1 ? 0 : currentIndex + 1;
      }

      const target = buttons[nextIndex];
      if (target) {
        target.focus({ preventScroll: true });
      }
      event.preventDefault();
    }
  };
  private isVisible = false;
  private lastSignature: string | null = null;
  private rafUpdater = rafThrottle((rects: OverlayBoxes) => this.render(rects));

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

    const segmentsRoot = document.createElement('div');
    segmentsRoot.style.position = 'absolute';
    segmentsRoot.style.top = '0';
    segmentsRoot.style.left = '0';
    segmentsRoot.style.pointerEvents = 'none';
    root.appendChild(segmentsRoot);

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

    const chooserRoot = document.createElement('div');
    chooserRoot.style.position = 'absolute';
    chooserRoot.style.top = '0';
    chooserRoot.style.right = '0';
    chooserRoot.style.transform = 'translate(50%, -50%)';
    chooserRoot.style.pointerEvents = 'auto';
    chooserRoot.style.display = 'none';
    chooserRoot.style.flexDirection = 'column';
    chooserRoot.style.gap = '6px';
    chooserRoot.style.padding = '8px';
    chooserRoot.style.borderRadius = '12px';
    chooserRoot.style.border = '1px solid rgba(15,23,42,0.12)';
    chooserRoot.style.background = '#ffffff';
    chooserRoot.style.boxShadow = '0 8px 20px rgba(15,23,42,0.16)';
    chooserRoot.style.minWidth = '160px';
    chooserRoot.style.zIndex = '1';
    chooserRoot.setAttribute('role', 'dialog');
    chooserRoot.setAttribute('aria-modal', 'false');
    chooserRoot.setAttribute('aria-hidden', 'true');
    chooserRoot.addEventListener('keydown', this.handleChooserKeyDown);

    const editButton = document.createElement('button');
    editButton.type = 'button';
    editButton.textContent = BADGE_LABEL;
    editButton.setAttribute('aria-label', BADGE_LABEL);
    editButton.style.width = '100%';
    editButton.style.display = 'block';
    editButton.style.fontSize = '12px';
    editButton.style.fontWeight = '600';
    editButton.style.padding = '6px 10px';
    editButton.style.borderRadius = '8px';
    editButton.style.border = 'none';
    editButton.style.cursor = 'pointer';
    editButton.style.background = '#ff7751';
    editButton.style.color = '#ffffff';
    editButton.style.fontFamily = 'inherit';
    editButton.style.boxShadow = '0 1px 3px rgba(0,0,0,0.12)';

    editButton.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      this.callbacks.onChoose?.('edit', event);
      this.hideChooser();
    });

    const followButton = document.createElement('button');
    followButton.type = 'button';
    followButton.textContent = DEFAULT_FOLLOW_LABEL;
    followButton.setAttribute('aria-label', DEFAULT_FOLLOW_LABEL);
    followButton.style.width = '100%';
    followButton.style.display = 'block';
    followButton.style.fontSize = '12px';
    followButton.style.fontWeight = '600';
    followButton.style.padding = '6px 10px';
    followButton.style.borderRadius = '8px';
    followButton.style.border = '1px solid rgba(15,23,42,0.12)';
    followButton.style.cursor = 'pointer';
    followButton.style.background = '#ffffff';
    followButton.style.color = '#1f2933';
    followButton.style.fontFamily = 'inherit';

    followButton.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      this.callbacks.onChoose?.('follow', event);
      this.hideChooser();
    });

    chooserRoot.appendChild(editButton);
    chooserRoot.appendChild(followButton);
    root.appendChild(chooserRoot);

    this.chooserRoot = chooserRoot;
    this.chooserEditButton = editButton;
    this.chooserFollowButton = followButton;

    document.body.appendChild(root);
    this.root = root;
    this.segmentsRoot = segmentsRoot;
  }

  private applyChooserLabels(labels?: { edit?: string; follow?: string }): void {
    if (!this.chooserEditButton || !this.chooserFollowButton) {
      return;
    }

    const editLabel = labels?.edit ?? BADGE_LABEL;
    const followLabel = labels?.follow ?? DEFAULT_FOLLOW_LABEL;

    this.chooserEditButton.textContent = editLabel;
    this.chooserEditButton.setAttribute('aria-label', editLabel);

    this.chooserFollowButton.textContent = followLabel;
    this.chooserFollowButton.setAttribute('aria-label', followLabel);
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

  showChooser(rects: OverlayBoxes, opts: { labels?: { edit?: string; follow?: string } } = {}): void {
    if (this.mode === 'off') {
      return;
    }

    if (!rects.length) {
      return;
    }

    this.highlightRects(rects);
    this.ensureDom();

    if (!this.root || !this.chooserRoot) {
      return;
    }

    this.applyChooserLabels(opts.labels);

    if (this.badge) {
      this.badge.style.display = 'none';
    }

    this.previousFocus = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;

    this.chooserRoot.style.display = 'flex';
    this.chooserRoot.style.flexDirection = 'column';
    this.chooserRoot.setAttribute('aria-hidden', 'false');
    this.chooserOpen = true;
    this.isVisible = true;

    requestAnimationFrame(() => {
      if (this.chooserEditButton && this.chooserOpen) {
        this.chooserEditButton.focus({ preventScroll: true });
      }
    });
  }

  hideChooser(): void {
    if (!this.chooserOpen) {
      return;
    }

    this.chooserOpen = false;

    if (this.chooserRoot) {
      this.chooserRoot.style.display = 'none';
      this.chooserRoot.setAttribute('aria-hidden', 'true');
    }

    if (this.showBadge && this.badge) {
      this.badge.style.display = 'block';
    }

    const active = document.activeElement;
    if (
      this.previousFocus &&
      this.previousFocus.isConnected &&
      this.previousFocus !== active &&
      this.chooserRoot &&
      active instanceof Node &&
      this.chooserRoot.contains(active)
    ) {
      try {
        this.previousFocus.focus({ preventScroll: true });
      } catch {
        // Ignore focus restoration failures.
      }
    }

    this.previousFocus = null;

    this.callbacks.onCloseChooser?.();
  }

  isChooserOpen(): boolean {
    return this.chooserOpen;
  }

  hide(): void {
    if (this.mode === 'off') {
      return;
    }
    this.rafUpdater.cancel();
    this.hideChooser();
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
    this.hideChooser();
    if (this.root) {
      this.root.remove();
    }
    this.root = null;
    this.segmentsRoot = null;
    this.segments = [];
    this.badge = null;
    this.chooserRoot = null;
    this.chooserEditButton = null;
    this.chooserFollowButton = null;
    this.previousFocus = null;
    this.chooserOpen = false;
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
}
