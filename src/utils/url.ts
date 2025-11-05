/**
 * URL helpers shared by the visual editing runtime. Centralised here to keep
 * validation and sanitisation consistent across modules.
 */

/**
 * Ensure the base editing URL has a predictable shape (no trailing slash,
 * consistent origin/pathname). Throws when the input is missing or invalid.
 */
export function normalizeBaseUrl(url: string): string {
  if (!url) {
    throw new Error('baseEditingUrl is required');
  }

  const trimmed = url.trim();
  const sanitized = trimmed.endsWith('/') ? trimmed.slice(0, -1) : trimmed;

  try {
    const parsed = new URL(sanitized);
    return `${parsed.origin}${parsed.pathname.replace(/\/$/, '')}`;
  } catch {
    throw new Error('baseEditingUrl must be a valid URL');
  }
}

/**
 * Remove a trailing slash from the provided URL when present.
 */
export function stripTrailingSlash(value: string): string {
  return value.endsWith('/') ? value.slice(0, -1) : value;
}

