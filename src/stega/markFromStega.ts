/**
 * Walk the DOM, decode stega payloads, and stamp the attributes consumed by
 * the overlay. This module purposely contains no DOM mutation beyond stamping
 * edit URLs so the rest of the runtime can stay predictable.
 */
import {
  ATTR_EDIT_TARGET,
  ATTR_EDIT_URL,
  ATTR_GENERATED,
  GENERATED_VALUE,
  ATTR_EDITABLE
} from '../constants.js';
import { stampAttributes, stampDebugAttributes, type EditInfo } from '../dom/stamp.js';
import { decodeStega } from '../decode/stega.js';
import { type DecodedInfo } from '../decode/types.js';
import { fromDecoded, safeStringify } from '../utils/debug.js';
import { splitStega } from './split.js';
import type { MarkSummary } from '../types.js';
import { resolveDocument } from '../utils/dom.js';

// Narrow view of the controller's state that the marker requires.
type MarkContext = {
  root: ParentNode;
  debug?: boolean;
};

/**
 * Traverse `ctx.root`, stamp clickable overlays for any stega payloads found,
 * and return bookkeeping information that the controller can aggregate.
 */
export function markDOMFromStega(ctx: MarkContext): MarkSummary {
  const doc = resolveDocument(ctx.root);

  if (!doc) {
    return {
      editableTotal: 0,
      generatedStamped: 0,
      generatedUpdated: 0,
      explicitTotal: 0,
      scope: ctx.root
    };
  }

  // First pass: collect text nodes that actually contain encoded payloads.
  const showText =
    doc.defaultView?.NodeFilter?.SHOW_TEXT ?? (typeof NodeFilter !== 'undefined' ? NodeFilter.SHOW_TEXT : 4);
  const walker = doc.createTreeWalker(ctx.root, showText);

  const textNodes: Text[] = [];
  let current: Node | null;
  while ((current = walker.nextNode())) {
    if (!(current instanceof Text)) {
      continue;
    }
    const value = current.nodeValue ?? '';
    if (!value) {
      continue;
    }
    const split = splitStega(value);
    if (!split.encoded) {
      continue;
    }
    textNodes.push(current);
  }

  const stampedTargets = new Set<Element>();
  const updatedTargets = new Set<Element>();

  for (const node of textNodes) {
    const value = node.nodeValue ?? '';
    if (!value) {
      continue;
    }
    const split = splitStega(value);
    if (!split.encoded) {
      continue;
    }
    const decoded = decodeStega(value, split);
    if (!decoded) {
      continue;
    }
    const parent = node.parentElement;
    if (!parent) {
      continue;
    }
    const target = resolveTarget(parent);
    const info = toEditInfo(decoded);
    if (!info) {
      continue;
    }
    const wasGenerated = target.getAttribute(ATTR_GENERATED) === GENERATED_VALUE;
    const changed = stampAttributes(target, info);
    if (!wasGenerated || changed) {
      stampedTargets.add(target);
    }
    if (wasGenerated && changed) {
      updatedTargets.add(target);
    }
    if (ctx.debug) {
      const debugPayload = fromDecoded('stega', 'text', info.editUrl, target, decoded);
      stampDebugAttributes(target, {
        reason: 'stega',
        url: info.editUrl,
        infoJson: safeStringify(debugPayload)
      });
    }
    if (node.nodeValue !== split.cleaned) {
      node.nodeValue = split.cleaned ?? value;
    }
  }

  // Second pass: inspect image alts, since they are not part of the text walker.
  const scope = ctx.root as ParentNode & {
    querySelectorAll: typeof document.querySelectorAll;
  };
  scope.querySelectorAll('img[alt]').forEach((node) => {
    const img = node as HTMLImageElement;
    const alt = img.getAttribute('alt');
    if (!alt) {
      return;
    }
    const split = splitStega(alt);
    if (!split.encoded) {
      return;
    }
    const decoded = decodeStega(alt, split);
    if (!decoded) {
      return;
    }
    const info = toEditInfo(decoded);
    if (!info) {
      return;
    }
    const target = preferWrapperIfZeroSize(img) ?? resolveTarget(img);
    const wasGenerated = target.getAttribute(ATTR_GENERATED) === GENERATED_VALUE;
    const changed = stampAttributes(target, info);
    if (!wasGenerated || changed) {
      stampedTargets.add(target);
    }
    if (wasGenerated && changed) {
      updatedTargets.add(target);
    }
    if (ctx.debug) {
      const debugPayload = fromDecoded('stega', 'alt', info.editUrl, target, decoded);
      stampDebugAttributes(target, {
        reason: 'stega',
        url: info.editUrl,
        infoJson: safeStringify(debugPayload)
      });
    }
    if (split.cleaned != null && split.cleaned !== alt) {
      img.setAttribute('alt', split.cleaned);
    }
  });

  // Keep elements clickable by marking them editable and summarise the sweep.
  const all = Array.from(scope.querySelectorAll<HTMLElement>(`[${ATTR_EDIT_URL}]`));
  all.forEach((el) => {
    el.setAttribute(ATTR_EDITABLE, '');
  });
  const generated = all.filter((el) => el.getAttribute(ATTR_GENERATED) === GENERATED_VALUE);
  const summary: MarkSummary = {
    editableTotal: all.length,
    generatedStamped: stampedTargets.size,
    generatedUpdated: updatedTargets.size,
    explicitTotal: all.length - generated.length,
    scope: ctx.root
  };

  return summary;
}

// If the site provided a wrapper via data-datocms-edit-target we stamp that instead.
function resolveTarget(start: Element): Element {
  const wrapper = start.closest<HTMLElement>(`[${ATTR_EDIT_TARGET}]`);
  return wrapper ?? start;
}

// Invisible images often live inside wrappers that have layout; prefer those.
function preferWrapperIfZeroSize(img: HTMLImageElement): Element | null {
  if (typeof img.getBoundingClientRect !== 'function') {
    return null;
  }
  const rect = img.getBoundingClientRect();
  if (rect.width === 0 || rect.height === 0) {
    const wrapper = img.closest<HTMLElement>(`[${ATTR_EDIT_TARGET}]`);
    if (wrapper) {
      return wrapper;
    }
  }
  return null;
}

/**
 * Shrink the decoded payload down to the data we want to stamp on the element.
 * Today that's only the resolved edit URL; everything else is for tooling.
 */
function toEditInfo(decoded: DecodedInfo): EditInfo | null {
  const editUrl = decoded.editUrl?.trim();
  if (!editUrl) {
    return null;
  }

  return { editUrl };
}
