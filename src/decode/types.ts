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
