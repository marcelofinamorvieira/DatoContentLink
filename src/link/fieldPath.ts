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
