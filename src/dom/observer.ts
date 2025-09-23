import { decodeStega } from '../decode/stega.js';
import { DecodedInfo } from '../decode/types.js';

const TEXT_SELECTOR = [
  'p',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'span',
  'li',
  'figcaption',
  'blockquote',
  'a',
  'strong',
  'em',
  'small',
  'dd',
  'dt',
  'td',
  'th',
  'caption',
  '[data-datocms-edit-target]',
  '[data-vercel-edit-target]',
  '[data-datocms-field-path]'
].join(',');

const IMAGE_SELECTOR = 'img[alt]';

type CacheEntry = {
  info: DecodedInfo;
  signature: string;
};

export type StegaMatch = {
  element: Element;
  info: DecodedInfo;
};

export class StegaObserver {
  private observer: MutationObserver | null = null;
  private readonly cache = new WeakMap<Element, CacheEntry>();
  private readonly signatures = new WeakMap<Element, string>();
  private readonly matched = new Set<Element>();

  start(): void {
    if (typeof window === 'undefined' || typeof document === 'undefined') {
      return;
    }
    if (!document.body) {
      return;
    }
    this.scan(document.body);
    this.setupObserver();
  }

  stop(): void {
    if (this.observer) {
      this.observer.disconnect();
      this.observer = null;
    }
    this.matched.clear();
  }

  getMatch(target: Element): StegaMatch | null {
    let current: Element | null = target;
    while (current) {
      const entry = this.cache.get(current);
      if (entry) {
        return { element: current, info: entry.info };
      }
      current = current.parentElement;
    }
    return null;
  }

  findMatchWithin(root: Element): StegaMatch | null {
    for (const element of this.matched) {
      if (root.contains(element)) {
        const entry = this.cache.get(element);
        if (entry) {
          return { element, info: entry.info };
        }
      }
    }
    return null;
  }

  private setupObserver(): void {
    if (this.observer) {
      return;
    }

    this.observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (mutation.type === 'childList') {
          mutation.addedNodes.forEach((node) => {
            if (node instanceof Element) {
              this.scan(node);
            }
          });
          mutation.removedNodes.forEach((node) => {
            if (node instanceof Element) {
              this.clear(node);
            }
          });
        } else if (mutation.type === 'characterData') {
          const parent = mutation.target.parentElement;
          if (parent) {
            this.processElement(parent);
          }
        } else if (mutation.type === 'attributes') {
          if (mutation.target instanceof HTMLImageElement && mutation.attributeName === 'alt') {
            this.processElement(mutation.target);
          }
          if (mutation.target instanceof Element && mutation.attributeName === 'data-datocms-field-path') {
            this.processElement(mutation.target);
          }
        }
      }
    });

    this.observer.observe(document.body, {
      subtree: true,
      childList: true,
      characterData: true,
      attributes: true,
      attributeFilter: ['alt', 'data-datocms-field-path']
    });
  }

  private scan(root: Element): void {
    this.processElement(root);
    root.querySelectorAll(TEXT_SELECTOR).forEach((element) => this.processElement(element));
    root.querySelectorAll(IMAGE_SELECTOR).forEach((element) => this.processElement(element));
  }

  private clear(root: Element): void {
    this.cache.delete(root);
    this.signatures.delete(root);
    this.matched.delete(root);
    root.querySelectorAll('*').forEach((node) => {
      if (node instanceof Element) {
        this.cache.delete(node);
        this.signatures.delete(node);
        this.matched.delete(node);
      }
    });
  }

  private processElement(element: Element): void {
    const signature = this.signatureFor(element);
    if (!signature) {
      this.cache.delete(element);
      this.signatures.delete(element);
      this.matched.delete(element);
      return;
    }

    const previousSignature = this.signatures.get(element);
    if (previousSignature === signature.signature) {
      return;
    }

    this.signatures.set(element, signature.signature);
    const info = decodeStega(signature.value);

    if (info) {
      this.cache.set(element, { info, signature: signature.signature });
      this.matched.add(element);
    } else {
      this.cache.delete(element);
      this.matched.delete(element);
    }
  }

  private signatureFor(element: Element): { value: string; signature: string } | null {
    if (element instanceof HTMLImageElement) {
      const alt = element.getAttribute('alt');
      if (!alt) {
        return null;
      }
      return { value: alt, signature: `alt:${alt}` };
    }

    const text = element.textContent;
    if (!text) {
      return null;
    }

    return { value: text, signature: `text:${text}` };
  }
}
