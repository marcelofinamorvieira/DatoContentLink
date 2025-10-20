/**
 * Helpers focused on `<img alt>` attributes that may contain stega payloads.
 * These wrap the lower-level stega utilities with image-specific ergonomics.
 */
import { splitStega } from '../stega/split.js';
import { decodeStega } from '../decode/stega.js';
import type { DecodedInfo } from '../decode/types.js';

export type WithDatoImageAltResult = {
  cleanedAlt: string;
  editInfo: DecodedInfo | null;
};

/**
 * Remove the steganographic payload from a DatoCMS image `alt` value while keeping the visible label intact.
 */
export function stripDatoImageAlt(alt: string | null | undefined): string {
  if (typeof alt !== 'string' || alt.length === 0) {
    return typeof alt === 'string' ? alt : '';
  }
  const split = splitStega(alt);
  return split.cleaned ?? alt;
}

/**
 * Decode the steganographic payload embedded into a DatoCMS image `alt` value.
 */
export function decodeDatoImageAlt(alt: string | null | undefined): DecodedInfo | null {
  if (typeof alt !== 'string' || alt.length === 0) {
    return null;
  }
  return decodeStega(alt);
}

/**
 * Convenience helper that returns both the cleaned `alt` label and any decoded edit metadata.
 */
export function withDatoImageAlt(alt: string | null | undefined): WithDatoImageAltResult {
  if (typeof alt !== 'string') {
    return { cleanedAlt: '', editInfo: null };
  }
  const split = splitStega(alt);
  const cleanedAlt = split.cleaned ?? alt;
  const editInfo = split.encoded ? decodeStega(alt, split) : null;
  return { cleanedAlt, editInfo };
}
