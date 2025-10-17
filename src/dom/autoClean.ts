import { splitStega } from '../stega/split.js';
import { AUTO_CLEAN_ATTR } from '../utils/attr.js';

export type AutoCleanOptions = {
  delayMs?: number;
  observe?: boolean;
  cleanImageAlts?: boolean;
  observeImageAlts?: boolean;
  skipSelectors?: string[];
};

const DEFAULT_DELAY_MS = 32;
const DEFAULT_OBSERVE = false;
const DEFAULT_CLEAN_IMAGE_ALTS = true;
const DEFAULT_OBSERVE_IMAGE_ALTS = true;
const DEFAULT_SKIP_SELECTORS = ['[contenteditable="true"]'] as const;

const NOOP = () => {
  /* noop */
};

function resolveOptions(raw?: AutoCleanOptions): Required<AutoCleanOptions> {
  return {
    delayMs: raw?.delayMs ?? DEFAULT_DELAY_MS,
    observe: raw?.observe ?? DEFAULT_OBSERVE,
    cleanImageAlts: raw?.cleanImageAlts ?? DEFAULT_CLEAN_IMAGE_ALTS,
    observeImageAlts: raw?.observeImageAlts ?? DEFAULT_OBSERVE_IMAGE_ALTS,
    skipSelectors: raw?.skipSelectors ? [...raw.skipSelectors] : [...DEFAULT_SKIP_SELECTORS]
  };
}

export function autoCleanStegaWithin(root: Element, raw?: AutoCleanOptions): () => void {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return NOOP;
  }
  if (!root) {
    return NOOP;
  }

  const opts = resolveOptions(raw);

  let disposed = false;
  let timer: number | null = null;
  let observer: MutationObserver | null = null;

  const schedule = () => {
    if (disposed || timer != null) {
      return;
    }
    timer = window.setTimeout(() => {
      timer = null;
      if (disposed) {
        return;
      }
      cleanPass(root, opts);
    }, opts.delayMs);
  };

  schedule();

  if (opts.observe) {
    observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (mutation.type === 'characterData' || mutation.type === 'childList') {
          schedule();
          break;
        }
        if (
          opts.observeImageAlts &&
          mutation.type === 'attributes' &&
          mutation.attributeName === 'alt'
        ) {
          schedule();
          break;
        }
      }
    });

    observer.observe(root, {
      subtree: true,
      childList: true,
      characterData: true,
      attributes: opts.observeImageAlts,
      attributeFilter: opts.observeImageAlts ? ['alt'] : undefined
    });
  }

  return () => {
    disposed = true;
    if (timer != null) {
      window.clearTimeout(timer);
      timer = null;
    }
    if (observer) {
      observer.disconnect();
      observer = null;
    }
  };
}

function isSkipped(element: Element | null, selectors: readonly string[]): boolean {
  if (!element || selectors.length === 0) {
    return false;
  }
  return selectors.some((selector) => element.closest(selector));
}

function cleanPass(root: Element, opts: Required<AutoCleanOptions>): void {
  if (!root.isConnected) {
    return;
  }

  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let current = walker.nextNode();
  while (current) {
    const node = current as Text;
    const parent = node.parentElement;
    const value = node.nodeValue ?? '';
    if (value && !isSkipped(parent, opts.skipSelectors)) {
      const split = splitStega(value);
      if (split.encoded && split.cleaned !== value) {
        node.nodeValue = split.cleaned;
      }
    }
    current = walker.nextNode();
  }

  if (!opts.cleanImageAlts) {
    return;
  }

  const images = root.querySelectorAll('img[alt]');
  images.forEach((img) => {
    if (isSkipped(img, opts.skipSelectors)) {
      return;
    }
    const alt = img.getAttribute('alt');
    if (!alt) {
      return;
    }
    const split = splitStega(alt);
    if (split.encoded && split.cleaned !== alt) {
      img.setAttribute('alt', split.cleaned);
    }
  });
}

export function enableDatoAutoClean(
  selector = `[${AUTO_CLEAN_ATTR}]`,
  rawOpts?: Omit<AutoCleanOptions, 'observe'>
): () => void {
  if (typeof document === 'undefined') {
    return NOOP;
  }

  const options = resolveOptions(rawOpts);
  const elements = Array.from(document.querySelectorAll(selector));
  if (elements.length === 0) {
    return NOOP;
  }

  const disposers = elements.map((element) => autoCleanStegaWithin(element, options));

  return () => {
    disposers.forEach((dispose) => dispose());
  };
}
