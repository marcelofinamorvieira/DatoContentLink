/**
 * Utility helpers for normalizing fieldPath fragments that DatoCMS relies on.
 * These are shared by both the decoder and explicit attribute builders so that
 * we produce consistent editor deep links regardless of input shape.
 */
type Segment = string;

// Collapse whitespace within a segment and drop it entirely when empty.
function sanitizeSegment(segment: string): string | null {
  const trimmed = segment.trim();
  if (!trimmed) {
    return null;
  }
  return trimmed;
}

// Support arrays like ['hero', 0, 'title'] by normalizing each fragment.
function fromArray(value: unknown[]): string | null {
  const segments: Segment[] = [];
  for (const part of value) {
    if (typeof part === 'string') {
      const sanitized = sanitizeSegment(part);
      if (!sanitized) {
        return null;
      }
      segments.push(sanitized);
    } else if (typeof part === 'number' && Number.isFinite(part)) {
      segments.push(String(part));
    } else {
      return null;
    }
  }
  if (!segments.length) {
    return null;
  }
  return segments.join('.');
}

/**
 * Accepts loose input (string, array, number) and returns a sanitized dot-path
 * or null when the value cannot be interpreted as a fieldPath.
 */
export function normalizeFieldPath(path: unknown): string | null {
  if (path == null) {
    return null;
  }

  if (typeof path === 'string') {
    const trimmed = path.trim();
    if (!trimmed) {
      return null;
    }
    return trimmed.replace(/\s+/g, '');
  }

  if (Array.isArray(path)) {
    return fromArray(path);
  }

  if (typeof path === 'number' && Number.isFinite(path)) {
    return String(path);
  }

  return null;
}

/**
 * Append the locale segment to the fieldPath when requested. This mirrors how
 * the editor expects localized fields to be referenced in hash fragments.
 */
export function withLocaleFieldPath(
  fieldPath: string | null,
  locale: string | null | undefined
): string | null {
  if (!fieldPath) {
    return fieldPath;
  }

  if (!locale) {
    return fieldPath;
  }

  const trimmedLocale = locale.trim();
  if (!trimmedLocale) {
    return fieldPath;
  }

  const segments = fieldPath.split('.');
  const lastSegment = segments[segments.length - 1];
  if (lastSegment === trimmedLocale) {
    return fieldPath;
  }

  return `${fieldPath}.${trimmedLocale}`;
}

/**
 * Inspect a URL hash for an encoded `fieldPath` parameter. Handles both proper
 * URLs and strings that merely contain a hash fragment.
 */
export function extractFieldPathFromUrl(url: string): string | null {
  if (!url) {
    return null;
  }

  const parse = (value: string): string | null => {
    if (!value) {
      return null;
    }
    const params = new URLSearchParams(value);
    const fieldPath = params.get('fieldPath');
    return fieldPath && fieldPath.trim().length > 0 ? fieldPath : null;
  };

  try {
    const parsed = new URL(url);
    const hash = parsed.hash.startsWith('#') ? parsed.hash.slice(1) : parsed.hash;
    const result = parse(hash);
    if (result) {
      return result;
    }
  } catch (error) {
    // Ignore errors from invalid URLs and fallback below.
  }

  const hashIndex = url.indexOf('#');
  if (hashIndex === -1) {
    return null;
  }
  const hash = url.slice(hashIndex + 1);
  return parse(hash);
}

/**
 * Ensure that `fieldPath` appears inside the URL hash, preserving any existing
 * parameters. Falls back to appending manually when `url` cannot be parsed.
 */
export function mergeFieldPathIntoUrl(url: string, fieldPath: string): string {
  if (!fieldPath) {
    return url;
  }

  try {
    const parsed = new URL(url);
    const currentHash = parsed.hash.startsWith('#') ? parsed.hash.slice(1) : parsed.hash;
    const params = new URLSearchParams(currentHash);
    params.set('fieldPath', fieldPath);
    const nextHash = params.toString();
    parsed.hash = nextHash ? `#${nextHash}` : '';
    return parsed.toString();
  } catch (error) {
    const separator = url.includes('#') ? '&' : '#';
    return `${url}${separator}fieldPath=${encodeURIComponent(fieldPath)}`;
  }
}
