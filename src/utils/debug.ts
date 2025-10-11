import type { DecodedInfo } from '../decode/types.js';

export type DebugReason = 'stega' | 'explicit';
export type DebugSource = 'text' | 'alt' | 'attrs';

export type DebugPayload = {
  reason: DebugReason;
  source: DebugSource;
  constructedUrl: string;
  baseEditingUrl: string;
  environment?: string;
  target?: string;
  decoded?: {
    itemId?: string;
    itemTypeId?: string;
    fieldPath?: string;
    locale?: string | null;
    environment?: string | null;
    editUrl?: string;
    raw?: unknown;
  };
};

export function compactSelector(el: Element): string {
  const id = el.id ? `#${el.id}` : '';
  const cls = (el.getAttribute('class') ?? '')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 3)
    .map((c) => `.${c}`)
    .join('');
  return `${el.tagName.toLowerCase()}${id}${cls}`;
}

export function fromDecoded(
  reason: DebugReason,
  source: DebugSource,
  constructedUrl: string,
  baseEditingUrl: string,
  environment: string | undefined,
  el: Element,
  decoded?: DecodedInfo | null
): DebugPayload {
  return {
    reason,
    source,
    constructedUrl,
    baseEditingUrl,
    environment,
    target: compactSelector(el),
    decoded: decoded
      ? {
          itemId: decoded.itemId || undefined,
          itemTypeId: decoded.itemTypeId,
          fieldPath: decoded.fieldPath,
          locale: decoded.locale ?? null,
          environment: decoded.environment ?? null,
          editUrl: decoded.editUrl,
          raw: decoded.raw
        }
      : undefined
  };
}

export function safeStringify(value: unknown): string {
  try {
    const json = JSON.stringify(value);
    return json ?? JSON.stringify({ error: 'Empty debug payload' });
  } catch {
    return JSON.stringify({ error: 'Unable to stringify debug payload' });
  }
}
