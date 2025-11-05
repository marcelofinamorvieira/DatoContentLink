/**
 * String normalization helpers shared across the visual editing runtime. These
 * utilities keep trimming logic consistent and avoid duplicating defensive
 * checks in every module that reads optional values from external payloads.
 */

/**
 * Trim an arbitrary value, returning the string when non-empty and defined.
 * Preserves `undefined` for absent values so callers can fall back gracefully.
 */
export function trimmedOrUndefined(value: unknown): string | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

/**
 * Normalize an arbitrary value into a trimmed string or `null`. Preserves
 * explicit nulls and guards against empty/whitespace-only strings.
 */
export function trimmedOrNull(value: unknown): string | null {
  if (value == null) {
    return null;
  }
  if (typeof value !== 'string') {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

