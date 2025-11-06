/**
 * Lightweight diagnostics for inspecting the current stega footprint. Used by
 * the dev panel and debugging scripts to gauge whether overlays were stamped.
 */
import {
  ATTR_EDIT_URL,
  ATTR_GENERATED,
  GENERATED_VALUE,
  ATTR_EDITABLE
} from '../constants.js';
import { splitStega } from '../stega/split.js';
import { compactSelector } from './debug.js';

export type StegaState = {
  scope: ParentNode;
  editableTotal: number;
  generatedTotal: number;
  explicitTotal: number;
  encodedTextNodes: number;
  encodedImageAlts: number;
  samples: {
    editable?: string[];
  };
};

/**
 * Scan the DOM (or a subtree) and return counters describing how much stega
 * content remains. Helpful when diagnosing why overlays are or are not present.
 */
export function checkStegaState(root?: ParentNode): StegaState {
  const fallbackScope = (root ?? ({} as ParentNode)) as ParentNode;
  const globalDoc = typeof document !== 'undefined' ? document : null;
  const resolvedRoot = root ?? (globalDoc as unknown as ParentNode | null);

  if (!resolvedRoot) {
    return {
      scope: fallbackScope,
      editableTotal: 0,
      generatedTotal: 0,
      explicitTotal: 0,
      encodedTextNodes: 0,
      encodedImageAlts: 0,
      samples: {}
    };
  }

  const doc =
    resolvedRoot instanceof Document
      ? resolvedRoot
      : resolvedRoot.ownerDocument ?? globalDoc;

  const scope = resolvedRoot as ParentNode & {
    querySelectorAll: typeof document.querySelectorAll;
  };

  const editable = Array.from(scope.querySelectorAll<HTMLElement>(`[${ATTR_EDIT_URL}]`));
  const generated = editable.filter((el) => el.getAttribute(ATTR_GENERATED) === GENERATED_VALUE);

  editable.forEach((el) => {
    el.setAttribute(ATTR_EDITABLE, '');
  });

  let encodedTextNodes = 0;
  if (doc) {
    const showText =
      doc.defaultView?.NodeFilter?.SHOW_TEXT ?? (typeof NodeFilter !== 'undefined' ? NodeFilter.SHOW_TEXT : 4);
    const walker = doc.createTreeWalker(resolvedRoot, showText);
    let current: Node | null;
    while ((current = walker.nextNode())) {
      if (!(current instanceof Text)) {
        continue;
      }
      const value = current.nodeValue ?? '';
      if (!value) {
        continue;
      }
      if (splitStega(value).encoded) {
        encodedTextNodes += 1;
      }
    }
  }

  let encodedImageAlts = 0;
  scope.querySelectorAll('img[alt]').forEach((node) => {
    const alt = node.getAttribute('alt');
    if (!alt) {
      return;
    }
    if (splitStega(alt).encoded) {
      encodedImageAlts += 1;
    }
  });

  const editableSamples = editable.slice(0, 3).map((el) => compactSelector(el));

  return {
    scope: resolvedRoot,
    editableTotal: editable.length,
    generatedTotal: generated.length,
    explicitTotal: editable.length - generated.length,
    encodedTextNodes,
    encodedImageAlts,
    samples: {
      editable: editableSamples.length ? editableSamples : undefined
    }
  };
}
