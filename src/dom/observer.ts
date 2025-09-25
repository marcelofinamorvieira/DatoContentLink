import { decodeStega, stripStega } from '../decode/stega.js';
import { DecodedInfo } from '../decode/types.js';

type CacheEntry = {
  info: DecodedInfo;
  signature: string;
  cleaned: string;
};

export type ImageStegaMatch = {
  element: Element;
  info: DecodedInfo;
};

export type TextStegaMatch = {
  node: Text;
  info: DecodedInfo;
};

const NON_RENDERED_PARENTS = new Set(['SCRIPT', 'STYLE', 'TEMPLATE', 'NOSCRIPT']);

type StegaObserverOptions = {
  persistAfterClean: boolean;
  debug: boolean;
};

export class StegaObserver {
  private observer: MutationObserver | null = null;
  private readonly textCache = new WeakMap<Text, CacheEntry>();
  private readonly textSignatures = new WeakMap<Text, string>();
  private readonly textMatched = new Set<Text>();
  private readonly imageCache = new WeakMap<Element, CacheEntry>();
  private readonly imageSignatures = new WeakMap<Element, string>();
  private readonly imageMatched = new Set<Element>();

  constructor(private readonly options: StegaObserverOptions = { persistAfterClean: true, debug: false }) {}

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
    this.textMatched.clear();
    this.imageMatched.clear();
  }

  getImageMatch(target: Element): ImageStegaMatch | null {
    let current: Element | null = target;
    while (current) {
      const entry = this.imageCache.get(current);
      if (entry) {
        return { element: current, info: entry.info };
      }
      current = current.parentElement;
    }
    return null;
  }

  getTextMatchesWithin(root: Element): TextStegaMatch[] {
    const matches: TextStegaMatch[] = [];
    for (const node of this.textMatched) {
      if (!node.isConnected) {
        this.clearTextNode(node);
        continue;
      }
      if (root.contains(node)) {
        const entry = this.textCache.get(node);
        if (entry) {
          matches.push({ node, info: entry.info });
        }
      }
    }
    return matches;
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
            } else if (node instanceof Text) {
              this.processTextNode(node);
            }
          });
          mutation.removedNodes.forEach((node) => {
            if (node instanceof Element) {
              this.clear(node);
            } else if (node instanceof Text) {
              this.clearTextNode(node);
            }
          });
        } else if (mutation.type === 'characterData') {
          if (mutation.target instanceof Text) {
            this.processTextNode(mutation.target);
          }
        } else if (mutation.type === 'attributes') {
          if (mutation.target instanceof HTMLImageElement && mutation.attributeName === 'alt') {
            this.processImage(mutation.target);
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
    this.visitNode(root);
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT);
    while (walker.nextNode()) {
      const current = walker.currentNode;
      if (current) {
        this.visitNode(current);
      }
    }
  }

  private clear(root: Element): void {
    if (root instanceof HTMLImageElement) {
      this.clearImage(root);
    }

    const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT);
    let current: Node | null = walker.currentNode;
    while (current) {
      if (current instanceof Text) {
        this.clearTextNode(current);
      } else if (current instanceof HTMLImageElement) {
        this.clearImage(current);
      }
      current = walker.nextNode();
    }
  }

  private visitNode(node: Node): void {
    if (node instanceof Text) {
      this.processTextNode(node);
    } else if (node instanceof HTMLImageElement) {
      this.processImage(node);
    }
  }

  private processTextNode(node: Text): void {
    const parent = node.parentElement;
    if (!parent || NON_RENDERED_PARENTS.has(parent.tagName)) {
      this.clearTextNode(node);
      return;
    }

    const value = node.nodeValue ?? '';
    if (!value) {
      this.clearTextNode(node);
      return;
    }

    const previousEntry = this.textCache.get(node);

    const decoded = decodeStega(value);
    if (decoded) {
      const cleaned = stripStega(value);
      const signature = `text:encoded:${value}`;
      if (this.textSignatures.get(node) === signature) {
        return;
      }
      this.textCache.set(node, { info: decoded, signature, cleaned });
      this.textSignatures.set(node, signature);
      this.textMatched.add(node);
      return;
    }

    if (this.options.persistAfterClean && previousEntry && value === previousEntry.cleaned) {
      const signature = `text:clean:${value}`;
      if (this.textSignatures.get(node) === signature) {
        this.textMatched.add(node);
        return;
      }
      this.textCache.set(node, { info: previousEntry.info, signature, cleaned: value });
      this.textSignatures.set(node, signature);
      this.textMatched.add(node);
      if (this.options.debug) {
        console.log('[datocms-visual-editing][debug] persisted after clean (text node)', {
          node,
          value,
          info: previousEntry.info
        });
      }
      return;
    }

    this.clearTextNode(node);
  }

  private processImage(element: HTMLImageElement): void {
    const alt = element.getAttribute('alt') ?? '';
    if (!alt) {
      this.clearImage(element);
      return;
    }

    const previousEntry = this.imageCache.get(element);

    const decoded = decodeStega(alt);
    if (decoded) {
      const cleaned = stripStega(alt);
      const signature = `alt:encoded:${alt}`;
      if (this.imageSignatures.get(element) === signature) {
        return;
      }
      this.imageCache.set(element, { info: decoded, signature, cleaned });
      this.imageSignatures.set(element, signature);
      this.imageMatched.add(element);
      return;
    }

    if (this.options.persistAfterClean && previousEntry && alt === previousEntry.cleaned) {
      const signature = `alt:clean:${alt}`;
      if (this.imageSignatures.get(element) === signature) {
        this.imageMatched.add(element);
        return;
      }
      this.imageCache.set(element, { info: previousEntry.info, signature, cleaned: alt });
      this.imageSignatures.set(element, signature);
      this.imageMatched.add(element);
      if (this.options.debug) {
        console.log('[datocms-visual-editing][debug] persisted after clean (image alt)', {
          element,
          alt,
          info: previousEntry.info
        });
      }
      return;
    }

    this.clearImage(element);
  }

  private clearTextNode(node: Text): void {
    this.textCache.delete(node);
    this.textSignatures.delete(node);
    this.textMatched.delete(node);
  }

  private clearImage(element: Element): void {
    this.imageCache.delete(element);
    this.imageSignatures.delete(element);
    this.imageMatched.delete(element);
  }
}
