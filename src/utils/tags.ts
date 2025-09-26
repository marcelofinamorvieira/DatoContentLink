import {
  extractFieldPathFromUrl,
  mergeFieldPathIntoUrl,
  normalizeFieldPath,
  withLocaleFieldPath
} from '../link/fieldPath.js';
import {
  DATA_ATTR_EDIT_INFO,
  DATA_ATTR_ITEM_ID,
  DATA_ATTR_ITEM_TYPE_ID,
  DATA_ATTR_EDIT_URL,
  DATA_ATTR_ENV,
  DATA_ATTR_LOCALE,
  EXPLICIT_ATTRIBUTE_NAMES
} from './attr.js';

export type EditTagInfo = {
  itemId?: string;
  itemTypeId?: string;
  fieldPath?: string | Array<string | number>;
  environment?: string;
  locale?: string;
  editUrl?: string;
  _editingUrl?: string;
};

export type EditTagFormat = 'json' | 'attrs';

export function buildEditTagAttributes(
  info: EditTagInfo,
  format: EditTagFormat = 'json'
): Record<string, string> {
  const cleanedItemId = cleanString(info.itemId);
  const cleanedItemTypeId = cleanString(info.itemTypeId);
  const cleanedEnvironment = cleanString(info.environment);
  const cleanedLocale = cleanString(info.locale);
  const cleanedEditUrl = cleanString(info.editUrl);
  const cleanedEditingUrl = cleanString(info._editingUrl);
  const resolvedEditUrl = cleanedEditUrl ?? cleanedEditingUrl;
  const explicitFieldPath = normalizeFieldPath(info.fieldPath ?? undefined);
  const extractedFieldPath = resolvedEditUrl
    ? normalizeFieldPath(extractFieldPathFromUrl(resolvedEditUrl) ?? undefined)
    : null;
  const baseFieldPath = explicitFieldPath ?? extractedFieldPath;
  const fieldPathWithLocale = withLocaleFieldPath(baseFieldPath, cleanedLocale);
  const resolvedFieldPath = fieldPathWithLocale ?? undefined;
  const editUrlWithFieldPath =
    resolvedEditUrl && resolvedFieldPath
      ? mergeFieldPathIntoUrl(resolvedEditUrl, resolvedFieldPath)
      : resolvedEditUrl;

  if (!cleanedItemId && !editUrlWithFieldPath) {
    return {};
  }

  if (format === 'attrs') {
    const attrs: Record<string, string> = {};
    if (cleanedItemId) {
      attrs[DATA_ATTR_ITEM_ID] = cleanedItemId;
    }
    if (cleanedItemTypeId) {
      attrs[DATA_ATTR_ITEM_TYPE_ID] = cleanedItemTypeId;
    }
    if (editUrlWithFieldPath) {
      attrs[DATA_ATTR_EDIT_URL] = editUrlWithFieldPath;
    }
    if (cleanedEnvironment) {
      attrs[DATA_ATTR_ENV] = cleanedEnvironment;
    }
    if (cleanedLocale) {
      attrs[DATA_ATTR_LOCALE] = cleanedLocale;
    }
    return attrs;
  }

  const payload: Record<string, string> = {};
  if (cleanedItemId) {
    payload.itemId = cleanedItemId;
  }
  if (cleanedItemTypeId) {
    payload.itemTypeId = cleanedItemTypeId;
  }
  if (cleanedEnvironment) {
    payload.environment = cleanedEnvironment;
  }
  if (cleanedLocale) {
    payload.locale = cleanedLocale;
  }
  if (editUrlWithFieldPath) {
    payload.editUrl = editUrlWithFieldPath;
  }
  if (resolvedFieldPath) {
    payload.fieldPath = resolvedFieldPath;
  }

  return {
    [DATA_ATTR_EDIT_INFO]: JSON.stringify(payload)
  };
}

export function applyEditTagAttributes(
  element: Element,
  info: EditTagInfo,
  format: EditTagFormat = 'json'
): void {
  for (const name of EXPLICIT_ATTRIBUTE_NAMES) {
    element.removeAttribute(name);
  }

  const attrs = buildEditTagAttributes(info, format);
  for (const [name, value] of Object.entries(attrs)) {
    element.setAttribute(name, value);
  }
}

function cleanString(value: string | undefined): string | undefined {
  if (value == null) {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}
