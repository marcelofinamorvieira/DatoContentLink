import type { DecodedInfo } from '../decode/types.js';
import { decodeStega } from '../decode/stega.js';
import { readExplicitInfo } from './attr.js';

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
