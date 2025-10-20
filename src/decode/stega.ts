/**
 * Steganography helpers built on top of @vercel/stega.
 * These utilities decode the zero-width encoded metadata that DatoCMS embeds
 * into strings (text content, alt attributes, etc.) and normalize the result
 * into the strongly typed structure consumed by the rest of the SDK.
 */
import { vercelStegaDecode, vercelStegaSplit } from '@vercel/stega';
import { DecodedInfo } from './types.js';
import { extractFieldPathFromUrl } from '../link/fieldPath.js';

/**
 * Decode the stega payload embedded inside `input`, returning the core metadata
 * the overlay system understands. If the string does not contain an encoded
 * segment (or if decoding fails) we return null so callers can skip stamping.
 */
export function decodeStega(
  input: string,
  split?: ReturnType<typeof vercelStegaSplit>
): DecodedInfo | null {
  if (!input) {
    return null;
  }

  const resolvedSplit = split ?? vercelStegaSplit(input);
  if (!resolvedSplit.encoded) {
    return null;
  }

  let decoded: unknown;
  try {
    decoded = vercelStegaDecode(resolvedSplit.encoded);
  } catch {
    return null;
  }

  if (!decoded || typeof decoded !== 'object') {
    return null;
  }

  const data = decoded as Record<string, unknown>;

  let itemId = string(data.itemId);
  let itemTypeId = string(data.itemTypeId);
  let fieldPath = string(data.fieldPath);
  let environment = string(data.environment) ?? null;
  const locale = string(data.locale) ?? null;
  const origin = string(data.origin);
  const href = string(data.href);
  let editUrl = string(data.editUrl) ?? href;

  if (href && looksLikeDatoHref(href, origin)) {
    const derived = deriveDatoInfoFromHref(href);
    if (!itemId && derived.itemId) {
      itemId = derived.itemId;
    }
    if (!itemTypeId && derived.itemTypeId) {
      itemTypeId = derived.itemTypeId;
    }
    if (!fieldPath && derived.fieldPath) {
      fieldPath = derived.fieldPath;
    }
    if (!environment && typeof derived.environment !== 'undefined') {
      environment = derived.environment;
    }
  }

  if (!itemId && !editUrl) {
    return null;
  }

  const info: DecodedInfo = {
    cms: 'datocms',
    itemId: itemId ?? '',
    itemTypeId,
    fieldPath,
    environment,
    locale,
    editUrl,
    raw: decoded
  };

  return info;
}

/**
 * Remove stega metadata from a string while preserving the human-visible content.
 * Useful when rendering text back to end users or performing comparisons.
 */
export function stripStega(
  input: string,
  split?: ReturnType<typeof vercelStegaSplit>
): string {
  if (!input) {
    return '';
  }

  const resolvedSplit = split ?? vercelStegaSplit(input);
  return resolvedSplit.cleaned ?? input;
}

// Normalize arbitrary values into trimmed strings, returning undefined for anything empty.
function string(value: unknown): string | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

// We only try to derive IDs from hrefs that clearly point back to a DatoCMS admin host.
function looksLikeDatoHref(href: string, origin?: string): boolean {
  if (origin && !origin.includes('datocms')) {
    return false;
  }
  try {
    const url = new URL(href);
    return url.hostname.includes('datocms');
  } catch {
    return false;
  }
}

/**
 * Infer record identifiers from a DatoCMS editor URL, primarily used when the
 * upstream payload did not embed item IDs explicitly.
 */
function deriveDatoInfoFromHref(href: string): {
  itemId?: string;
  itemTypeId?: string;
  fieldPath?: string;
  environment?: string | null;
} {
  try {
    const url = new URL(href);
    const segments = url.pathname.split('/').filter(Boolean).map((part) => decodeURIComponent(part));

    let environment: string | null | undefined;
    let offset = 0;
    if (segments[offset] === 'environments' && segments.length > offset + 1) {
      environment = segments[offset + 1] || null;
      offset += 2;
    }

    let itemTypeId: string | undefined;
    let itemId: string | undefined;

    for (let index = offset; index < segments.length; index++) {
      const segment = segments[index];
      if (segment === 'item_types' && index + 1 < segments.length) {
        itemTypeId = segments[index + 1];
      }
      if (segment === 'items' && index + 1 < segments.length) {
        itemId = segments[index + 1];
      }
    }

    const extractedFieldPath = extractFieldPathFromUrl(href);
    const fieldPath = extractedFieldPath ?? undefined;

    return { itemId, itemTypeId, fieldPath, environment };
  } catch {
    return {};
  }
}
