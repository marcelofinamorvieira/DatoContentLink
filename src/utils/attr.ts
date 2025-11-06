/**
 * Helpers for working with explicit data-datocms-* attributes. These are used
 * when content is pre-annotated on the server or when the dev tools need to
 * reconstruct metadata without accessing stega payloads.
 */
import { DecodedInfo } from '../decode/types.js';
import { ATTR_EDIT_URL } from '../constants.js';
import { trimmedOrUndefined } from './string.js';

export const AUTO_CLEAN_ATTR = 'data-datocms-auto-clean';
export const DATA_ATTR_EDIT_INFO = 'data-datocms-edit-info';
/**
 * Aliases for the generated attribute names. Keeping them colocated with the
 * explicit-tag helpers makes it clear that both workflows share the exact same
 * DOM markers while still allowing consumers to import from a single module.
 */
export const DATA_ATTR_EDIT_URL = ATTR_EDIT_URL;
export const EXPLICIT_ATTRIBUTE_NAMES = [DATA_ATTR_EDIT_INFO, DATA_ATTR_EDIT_URL];

/**
 * Interpret explicit attributes on an element and return a DecodedInfo payload.
 * Falls back to JSON payloads when available and gracefully handles partial data.
 */
export function readExplicitInfo(element: Element): DecodedInfo | null {
  const jsonRaw = element.getAttribute(DATA_ATTR_EDIT_INFO);
  let fromJson: string | undefined;

  if (jsonRaw) {
    try {
      const parsed = JSON.parse(jsonRaw) as Record<string, unknown>;
      fromJson = trimmedOrUndefined(parsed.editUrl);
    } catch {
      fromJson = undefined;
    }
  }

  const attr = trimmedOrUndefined(element.getAttribute(DATA_ATTR_EDIT_URL));
  const resolved = attr ?? fromJson;

  if (!resolved) {
    return null;
  }

  return {
    cms: 'datocms',
    editUrl: resolved,
    raw: {
      source: 'explicit-tag',
      json: jsonRaw ?? null
    }
  };
}
