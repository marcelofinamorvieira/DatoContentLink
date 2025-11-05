/**
 * Helpers for generating or applying explicit edit tags on server-rendered
 * markup. While the runtime now stamps minimal attributes, these utilities
 * remain valuable for projects that annotate HTML ahead of time.
 */
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
import { trimmedOrUndefined } from './string.js';

export type EditTagInfo = {
  itemId?: string;
  itemTypeId?: string;
  fieldPath?: string | Array<string | number>;
  environment?: string;
  locale?: string;
  editUrl?: string;
  _editingUrl?: string;
};

export type EditTagFormat = 'url' | 'json' | 'attrs';

/**
 * Create the attributes that should be stamped on an element to expose edit
 * metadata. Defaults to the simplified URL-only format but still supports
 * richer JSON/attribute variants for tooling.
 */
export function buildEditTagAttributes(
  info: EditTagInfo,
  format: EditTagFormat = 'url'
): Record<string, string> {
  const cleanedItemId = trimmedOrUndefined(info.itemId);
  const cleanedItemTypeId = trimmedOrUndefined(info.itemTypeId);
  const cleanedEnvironment = trimmedOrUndefined(info.environment);
  const cleanedLocale = trimmedOrUndefined(info.locale);
  const cleanedEditUrl = trimmedOrUndefined(info.editUrl);
  const cleanedEditingUrl = trimmedOrUndefined(info._editingUrl);
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

  if (format === 'url') {
    if (!editUrlWithFieldPath) {
      return {};
    }
    return {
      [DATA_ATTR_EDIT_URL]: editUrlWithFieldPath
    };
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

/**
 * Helper that removes previous explicit attributes and applies the new set.
 * Keeps attribute churn minimal so the DOM stays predictable.
 */
export function applyEditTagAttributes(
  element: Element,
  info: EditTagInfo,
  format: EditTagFormat = 'url'
): void {
  for (const name of EXPLICIT_ATTRIBUTE_NAMES) {
    element.removeAttribute(name);
  }

  const attrs = buildEditTagAttributes(info, format);
  for (const [name, value] of Object.entries(attrs)) {
    element.setAttribute(name, value);
  }
}

