import { vercelStegaDecode, vercelStegaSplit } from '@vercel/stega';
import { DecodedInfo } from './types.js';

const ITEM_ID_KEYS = ['itemId', 'item_id', 'recordId', 'record_id', 'id'];
const ITEM_TYPE_ID_KEYS = ['itemTypeId', 'item_type_id', 'modelId', 'model_id', 'itemType'];
const FIELD_PATH_KEYS = ['fieldPath', 'field_path', 'field', 'path'];
const LOCALE_KEYS = ['locale', 'language', 'lang'];
const ENVIRONMENT_KEYS = ['environment', 'env'];
const EDIT_URL_KEYS = ['editUrl', 'url', 'href'];

const DATO_HOST_PATTERN = /\.datocms\.com\/?/i;
const ITEM_ID_FROM_URL = /\/items\/([^/?#]+)/;
const ITEM_TYPE_FROM_URL = /\/item_types\/([^/]+)/;
const ENV_FROM_URL = /\/environments\/([^/]+)/;

function pickString(source: unknown, keys: readonly string[]): string | undefined {
  if (!source || typeof source !== 'object') {
    return undefined;
  }

  for (const key of keys) {
    const value = (source as Record<string, unknown>)[key];
    if (typeof value === 'string' && value.trim().length > 0) {
      return value.trim();
    }
  }
  return undefined;
}

function normalizeLocale(value: string | undefined): string | null {
  if (!value) {
    return null;
  }
  return value.trim() || null;
}

function extractFromUrl(url: string) {
  const itemIdMatch = ITEM_ID_FROM_URL.exec(url);
  const itemTypeMatch = ITEM_TYPE_FROM_URL.exec(url);
  const envMatch = ENV_FROM_URL.exec(url);
  return {
    itemId: itemIdMatch?.[1],
    itemTypeId: itemTypeMatch?.[1],
    environment: envMatch?.[1]
  } as const;
}

export function stripStega(input: string): string {
  if (!input) {
    return '';
  }
  return vercelStegaSplit(input).cleaned;
}

export function decodeStega(input: string): DecodedInfo | null {
  if (!input) {
    return null;
  }

  const split = vercelStegaSplit(input);
  if (!split.encoded) {
    return null;
  }

  let raw: unknown;
  try {
    raw = vercelStegaDecode(split.encoded);
  } catch (error) {
    return null;
  }

  const editUrlCandidate = pickString(raw, EDIT_URL_KEYS);
  const editUrl = editUrlCandidate && DATO_HOST_PATTERN.test(editUrlCandidate) ? editUrlCandidate : undefined;

  const fromUrl = editUrl ? extractFromUrl(editUrl) : undefined;

  const itemId = pickString(raw, ITEM_ID_KEYS) ?? fromUrl?.itemId;
  const itemTypeId = pickString(raw, ITEM_TYPE_ID_KEYS) ?? fromUrl?.itemTypeId;
  const fieldPath = pickString(raw, FIELD_PATH_KEYS);
  const locale = normalizeLocale(pickString(raw, LOCALE_KEYS));
  const environment = normalizeLocale(pickString(raw, ENVIRONMENT_KEYS) ?? fromUrl?.environment);

  if (!itemId && !editUrl) {
    return null;
  }

  const info: DecodedInfo = {
    cms: 'datocms',
    itemId: itemId ?? '',
    itemTypeId,
    fieldPath,
    locale,
    environment,
    editUrl,
    raw
  };

  return info;
}
