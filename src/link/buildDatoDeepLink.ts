/**
 * Builds canonical DatoCMS editor URLs from decoded stega payloads. While the
 * runtime now prefers the upstream `editUrl`, this helper remains valuable for
 * env-specific overrides and for consumers that want to recreate deep links.
 */
import { DecodedInfo } from '../decode/types.js';
import {
  extractFieldPathFromUrl,
  mergeFieldPathIntoUrl,
  normalizeFieldPath,
  withLocaleFieldPath
} from './fieldPath.js';
import { stripTrailingSlash } from '../utils/url.js';

// Only treat the payload URL as authoritative when it belongs to the same project.
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

/**
 * Create a deep link into the DatoCMS editor. Prefers the payload's own
 * `editUrl` when it already matches the configured origin; otherwise we
 * reconstruct a URL using the supplied identifiers.
 */
export function buildDatoDeepLink(info: DecodedInfo, baseEditingUrl: string, environment?: string): string {
  if (!baseEditingUrl) {
    throw new Error('baseEditingUrl is required');
  }

  const normalizedBase = stripTrailingSlash(baseEditingUrl);

  if (info.editUrl && sameOrigin(info.editUrl, normalizedBase)) {
    const extractedFieldPath = normalizeFieldPath(
      info.fieldPath ?? extractFieldPathFromUrl(info.editUrl) ?? undefined
    );
    const fieldPathWithLocale = withLocaleFieldPath(extractedFieldPath, info.locale ?? null);
    if (fieldPathWithLocale) {
      return mergeFieldPathIntoUrl(info.editUrl, fieldPathWithLocale);
    }
    return info.editUrl;
  }

  const env = encodeEnv(environment ?? info.environment ?? undefined);
  const itemId = info.itemId;

  if (!itemId) {
    // Honor fully-qualified edit URLs even when they target a different origin.
    if (info.editUrl) {
      return info.editUrl;
    }
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

  const baseFieldPath = normalizeFieldPath(info.fieldPath);
  const fieldPath = withLocaleFieldPath(baseFieldPath, info.locale ?? null);
  const url = segments.join('/');

  if (fieldPath) {
    return mergeFieldPathIntoUrl(url, fieldPath);
  }

  return url;
}
