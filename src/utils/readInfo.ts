/**
 * Convenience helper to inspect an element and pull out whichever edit metadata
 * it exposes, regardless of whether it came from explicit attributes or stega.
 */
import type { DecodedInfo } from '../decode/types.js';
import { decodeStega } from '../decode/stega.js';
import { readExplicitInfo } from './attr.js';

/**
 * Return the decoded metadata for `element`, favoring explicit attributes first
 * and falling back to text/alt stega content.
 */
export function getDatoEditInfo(element: Element): DecodedInfo | null {
  const explicit = readExplicitInfo(element);
  if (explicit) {
    return explicit;
  }

  const text = element.textContent ?? '';
  if (text) {
    const decoded = decodeStega(text);
    if (decoded) {
      return decoded;
    }
  }

  if (element instanceof HTMLImageElement && element.alt) {
    return decodeStega(element.alt) ?? null;
  }

  return null;
}
