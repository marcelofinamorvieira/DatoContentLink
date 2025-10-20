/**
 * Canonical metadata extracted from a stega payload. Most properties are
 * optional because the upstream string might not provide them, but we always
 * surface the raw payload for debugging purposes.
 */
export type DecodedInfo = {
  cms: 'datocms';
  itemId: string;
  itemTypeId?: string;
  fieldPath?: string;
  locale?: string | null;
  environment?: string | null;
  editUrl?: string;
  raw: unknown;
};
