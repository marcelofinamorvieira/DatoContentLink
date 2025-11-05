/**
 * Helpers for working with explicit data-datocms-* attributes. These are used
 * when content is pre-annotated on the server or when the dev tools need to
 * reconstruct metadata without accessing stega payloads.
 */
import { DecodedInfo } from '../decode/types.js';
import { normalizeFieldPath } from '../link/fieldPath.js';
import {
  ATTR_EDIT_URL,
  ATTR_ITEM_ID,
  ATTR_ITEM_TYPE_ID,
  ATTR_ENV,
  ATTR_LOCALE
} from '../constants.js';
import { trimmedOrNull, trimmedOrUndefined } from './string.js';

export const AUTO_CLEAN_ATTR = 'data-datocms-auto-clean';
export const DATA_ATTR_EDIT_INFO = 'data-datocms-edit-info';
/**
 * Aliases for the generated attribute names. Keeping them colocated with the
 * explicit-tag helpers makes it clear that both workflows share the exact same
 * DOM markers while still allowing consumers to import from a single module.
 */
export const DATA_ATTR_ITEM_ID = ATTR_ITEM_ID;
export const DATA_ATTR_ITEM_TYPE_ID = ATTR_ITEM_TYPE_ID;
export const DATA_ATTR_EDIT_URL = ATTR_EDIT_URL;
export const DATA_ATTR_ENV = ATTR_ENV;
export const DATA_ATTR_LOCALE = ATTR_LOCALE;
export const FIELD_PATH_ATTR = 'data-datocms-field-path';
export const EXPLICIT_ATTRIBUTE_NAMES = [
  DATA_ATTR_EDIT_INFO,
  DATA_ATTR_ITEM_ID,
  DATA_ATTR_ITEM_TYPE_ID,
  DATA_ATTR_EDIT_URL,
  DATA_ATTR_ENV,
  DATA_ATTR_LOCALE
];

/**
 * Interpret explicit attributes on an element and return a DecodedInfo payload.
 * Falls back to JSON payloads when available and gracefully handles partial data.
 */
export function readExplicitInfo(element: Element): DecodedInfo | null {
  const jsonRaw = element.getAttribute(DATA_ATTR_EDIT_INFO);
  let fromJson: Partial<DecodedInfo> | null = null;

  if (jsonRaw) {
    try {
      const parsed = JSON.parse(jsonRaw) as Record<string, unknown>;
      fromJson = {
        itemId: trimmedOrUndefined(parsed.itemId),
        itemTypeId: trimmedOrUndefined(parsed.itemTypeId),
        fieldPath: normalizeFieldPath(parsed.fieldPath ?? undefined) ?? undefined,
        environment: trimmedOrNull(parsed.environment),
        locale: trimmedOrNull(parsed.locale),
        editUrl: trimmedOrUndefined(parsed.editUrl)
      };
    } catch {
      fromJson = null;
    }
  }

  const merged: Partial<DecodedInfo> = {
    ...fromJson,
    itemId: attrOr(fromJson?.itemId, element, DATA_ATTR_ITEM_ID),
    itemTypeId: attrOr(fromJson?.itemTypeId, element, DATA_ATTR_ITEM_TYPE_ID),
    editUrl: attrOr(fromJson?.editUrl, element, DATA_ATTR_EDIT_URL),
    environment: attrOr(fromJson?.environment ?? null, element, DATA_ATTR_ENV) ?? null,
    locale: attrOr(fromJson?.locale ?? null, element, DATA_ATTR_LOCALE) ?? null
  };

  if (!merged.itemId && !merged.editUrl) {
    return null;
  }

  const fieldPathAttr = element.getAttribute(FIELD_PATH_ATTR);
  const fieldPath = normalizeFieldPath(fieldPathAttr ?? merged.fieldPath);

  return {
    cms: 'datocms',
    itemId: merged.itemId ?? '',
    itemTypeId: merged.itemTypeId,
    fieldPath: fieldPath ?? undefined,
    environment: merged.environment ?? null,
    locale: merged.locale ?? null,
    editUrl: merged.editUrl,
    raw: {
      source: 'explicit-tag',
      json: jsonRaw ?? null
    }
  };
}

// Prefer the attribute value when set, otherwise fall back to the provided default.
function attrOr<T extends string | null | undefined>(fallback: T, element: Element, attribute: string): T {
  const raw = element.getAttribute(attribute);
  if (raw == null) {
    return fallback;
  }
  const trimmed = raw.trim();
  if (trimmed.length === 0) {
    return fallback;
  }
  return trimmed as T;
}
