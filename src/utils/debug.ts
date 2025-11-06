/**
 * Debug helpers shared by the dev panel and DOM annotators. Everything here is
 * pure data transformation so it can safely run in any environment.
 */
import type { DecodedInfo } from '../decode/types.js';

export type DebugReason = 'stega' | 'explicit';
export type DebugSource = 'text' | 'alt' | 'attrs';

export type DebugPayload = {
  reason: DebugReason;
  source: DebugSource;
  url: string;
  target?: string;
  decoded?: {
    editUrl?: string;
    raw?: unknown;
  };
};

/**
 * Build a short CSS-like selector for logging/debug output so developers can
 * quickly identify which element was touched.
 */
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

/**
 * Normalize decoded info plus runtime context into a stable debug payload.
 * The dev panel uses this to present detailed information without recomputing.
 */
export function fromDecoded(
  reason: DebugReason,
  source: DebugSource,
  url: string,
  el: Element,
  decoded?: DecodedInfo | null
): DebugPayload {
  return {
    reason,
    source,
    url,
    target: compactSelector(el),
    decoded: decoded
      ? {
          editUrl: decoded.editUrl,
          raw: decoded.raw
        }
      : undefined
  };
}

// Resilient stringify helper that never throws, even for cyclic references.
export function safeStringify(value: unknown): string {
  try {
    const json = JSON.stringify(value);
    return json ?? JSON.stringify({ error: 'Empty debug payload' });
  } catch {
    return JSON.stringify({ error: 'Unable to stringify debug payload' });
  }
}
