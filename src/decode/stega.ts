import { vercelStegaDecode, vercelStegaSplit } from '@vercel/stega';
import { DecodedInfo } from './types.js';

export function decodeStega(
  input: string,
  split?: ReturnType<typeof vercelStegaSplit>
): DecodedInfo | null {
  if (!input) {
    return null;
  }

  const resolvedSplit = split ?? vercelStegaSplit(input);
  if (!resolvedSplit.encoded) {
    return null;
  }

  let decoded: unknown;
  try {
    decoded = vercelStegaDecode(resolvedSplit.encoded);
  } catch {
    return null;
  }

  if (!decoded || typeof decoded !== 'object') {
    return null;
  }

  const data = decoded as Record<string, unknown>;

  const itemId = string(data.itemId);
  const itemTypeId = string(data.itemTypeId);
  const fieldPath = string(data.fieldPath);
  const environment = string(data.environment) ?? null;
  const locale = string(data.locale) ?? null;
  const editUrl = string(data.editUrl);

  if (!itemId && !editUrl) {
    return null;
  }

  const info: DecodedInfo = {
    cms: 'datocms',
    itemId: itemId ?? '',
    itemTypeId,
    fieldPath,
    environment,
    locale,
    editUrl,
    raw: decoded
  };

  return info;
}

export function stripStega(
  input: string,
  split?: ReturnType<typeof vercelStegaSplit>
): string {
  if (!input) {
    return '';
  }

  const resolvedSplit = split ?? vercelStegaSplit(input);
  return resolvedSplit.cleaned ?? input;
}

function string(value: unknown): string | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}
