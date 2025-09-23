import { DecodedInfo } from '../decode/types.js';
import { normalizeFieldPath } from './fieldPath.js';

function stripTrailingSlash(url: string): string {
  return url.endsWith('/') ? url.slice(0, -1) : url;
}

function sameOrigin(url: string, base: string): boolean {
  try {
    const target = new URL(url);
    const origin = new URL(base);
    return target.origin === origin.origin;
  } catch (error) {
    return false;
  }
}

function encodeEnv(env?: string | null): string | null {
  if (!env) {
    return null;
  }
  return encodeURIComponent(env);
}

export function buildDatoDeepLink(info: DecodedInfo, baseEditingUrl: string, environment?: string): string {
  if (!baseEditingUrl) {
    throw new Error('baseEditingUrl is required');
  }

  const normalizedBase = stripTrailingSlash(baseEditingUrl);

  if (info.editUrl && sameOrigin(info.editUrl, normalizedBase)) {
    return info.editUrl;
  }

  const env = encodeEnv(environment ?? info.environment ?? undefined);
  const itemId = info.itemId;

  if (!itemId) {
    throw new Error('Cannot build deep link without itemId or editUrl');
  }

  const segments = [normalizedBase];

  if (env) {
    segments.push(`environments/${env}`);
  }

  segments.push('editor');

  if (info.itemTypeId) {
    segments.push(`item_types/${encodeURIComponent(info.itemTypeId)}/items/${encodeURIComponent(itemId)}/edit`);
  } else {
    segments.push(`items/${encodeURIComponent(itemId)}/edit`);
  }

  const fieldPath = normalizeFieldPath(info.fieldPath);
  const url = segments.join('/');

  if (fieldPath) {
    return `${url}#fieldPath=${encodeURIComponent(fieldPath)}`;
  }

  return url;
}
