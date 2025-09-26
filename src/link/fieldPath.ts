type Segment = string;

function sanitizeSegment(segment: string): string | null {
  const trimmed = segment.trim();
  if (!trimmed) {
    return null;
  }
  return trimmed;
}

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

  if (typeof path === 'object') {
    const entries: string[] = [];
    for (const key of Object.keys(path as Record<string, unknown>)) {
      if (!Number.isNaN(Number(key))) {
        entries.push(key);
      } else {
        entries.push(key);
      }
    }
    if (entries.length === 0) {
      return null;
    }
    return entries.join('.');
  }

  if (typeof path === 'number' && Number.isFinite(path)) {
    return String(path);
  }

  return null;
}

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
