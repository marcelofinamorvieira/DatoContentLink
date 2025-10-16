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
import { buildDatoDeepLink } from '../link/buildDatoDeepLink.js';
import { fromDecoded, safeStringify } from '../utils/debug.js';
import { splitStega } from './split.js';
import type { MarkSummary } from '../types.js';

type MarkContext = {
  baseEditingUrl: string;
  environment?: string;
  root: ParentNode;
  debug?: boolean;
};

export function markDOMFromStega(ctx: MarkContext): MarkSummary {
  const docCtor = typeof Document !== 'undefined' ? Document : undefined;
  const globalDoc = typeof document !== 'undefined' ? document : undefined;
  const doc =
    (docCtor && ctx.root instanceof docCtor ? (ctx.root as Document) : ctx.root.ownerDocument ?? globalDoc) ?? null;

  if (!doc) {
    return {
      editableTotal: 0,
      generatedStamped: 0,
      generatedUpdated: 0,
      explicitTotal: 0,
      scope: ctx.root
    };
  }

  const walker = doc.createTreeWalker(ctx.root, NodeFilter.SHOW_TEXT);

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
    const info = toEditInfo(decoded, ctx);
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
      const debugPayload = fromDecoded(
        'stega',
        'text',
        info.editUrl,
        ctx.baseEditingUrl,
        ctx.environment,
        target,
        decoded
      );
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
    const info = toEditInfo(decoded, ctx);
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
      const debugPayload = fromDecoded(
        'stega',
        'alt',
        info.editUrl,
        ctx.baseEditingUrl,
        ctx.environment,
        target,
        decoded
      );
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

function resolveTarget(start: Element): Element {
  const wrapper = start.closest<HTMLElement>(`[${ATTR_EDIT_TARGET}]`);
  return wrapper ?? start;
}

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

function toEditInfo(decoded: DecodedInfo, ctx: MarkContext): EditInfo | null {
  let editUrl: string;
  try {
    editUrl = buildDatoDeepLink(decoded, ctx.baseEditingUrl, ctx.environment);
  } catch {
    return null;
  }

  const environment = ctx.environment ?? (decoded.environment ?? undefined);
  const locale = decoded.locale ?? undefined;

  return {
    editUrl,
    itemId: decoded.itemId || undefined,
    itemTypeId: decoded.itemTypeId,
    environment: environment ?? undefined,
    locale
  };
}
