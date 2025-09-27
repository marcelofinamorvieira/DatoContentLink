import { DecodedInfo } from '../decode/types.js';
import { normalizeFieldPath } from '../link/fieldPath.js';

export type TargetAttribute = 'data-datocms-edit-target' | 'data-vercel-edit-target';

export const AUTO_CLEAN_ATTR = 'data-datocms-auto-clean';
export const DATA_ATTR_EDIT_INFO = 'data-datocms-edit-info';
export const DATA_ATTR_ITEM_ID = 'data-datocms-item-id';
export const DATA_ATTR_ITEM_TYPE_ID = 'data-datocms-item-type-id';
export const DATA_ATTR_EDIT_URL = 'data-datocms-edit-url';
export const DATA_ATTR_ENV = 'data-datocms-environment';
export const DATA_ATTR_LOCALE = 'data-datocms-locale';
export const DATA_ATTR_CLICK_CONFLICT = 'data-datocms-click-conflict';
export const DATA_ATTR_ALLOW_FOLLOW = 'data-datocms-allow-follow';
export const FIELD_PATH_ATTR = 'data-datocms-field-path';
export const EXPLICIT_ATTRIBUTE_NAMES = [
  DATA_ATTR_EDIT_INFO,
  DATA_ATTR_ITEM_ID,
  DATA_ATTR_ITEM_TYPE_ID,
  DATA_ATTR_EDIT_URL,
  DATA_ATTR_ENV,
  DATA_ATTR_LOCALE,
  DATA_ATTR_CLICK_CONFLICT,
  DATA_ATTR_ALLOW_FOLLOW
];

const TARGET_ATTRS: TargetAttribute[] = ['data-datocms-edit-target', 'data-vercel-edit-target'];

export function resolveHighlightContainer(element: Element, preferred: TargetAttribute): Element {
  const attributes = preferred === 'data-vercel-edit-target'
    ? ['data-vercel-edit-target', 'data-datocms-edit-target']
    : ['data-datocms-edit-target', 'data-vercel-edit-target'];

  for (const attr of attributes) {
    const container = element.closest(`[${attr}]`);
    if (container && container !== document.body && container !== document.documentElement) {
      return container;
    }
  }

  return element;
}

export function hasDatoTarget(element: Element): boolean {
  return TARGET_ATTRS.some((attr) => element.hasAttribute(attr));
}

export function readExplicitInfo(element: Element): DecodedInfo | null {
  const jsonRaw = element.getAttribute(DATA_ATTR_EDIT_INFO);
  let fromJson: Partial<DecodedInfo> | null = null;

  if (jsonRaw) {
    try {
      const parsed = JSON.parse(jsonRaw) as Record<string, unknown>;
      fromJson = {
        itemId: stringOrUndefined(parsed.itemId),
        itemTypeId: stringOrUndefined(parsed.itemTypeId),
        fieldPath: normalizeFieldPath(parsed.fieldPath ?? undefined) ?? undefined,
        environment: stringOrNull(parsed.environment),
        locale: stringOrNull(parsed.locale),
        editUrl: stringOrUndefined(parsed.editUrl)
      };
    } catch {
      fromJson = null;
    }
  }

  const merged: Partial<DecodedInfo> = {
    ...fromJson,
    itemId: attrOr(fromJson?.itemId, element, DATA_ATTR_ITEM_ID),
    itemTypeId: attrOr(fromJson?.itemTypeId, element, DATA_ATTR_ITEM_TYPE_ID),
    editUrl: attrOr(fromJson?.editUrl, element, DATA_ATTR_EDIT_URL),
    environment: attrOr(fromJson?.environment ?? null, element, DATA_ATTR_ENV) ?? null,
    locale: attrOr(fromJson?.locale ?? null, element, DATA_ATTR_LOCALE) ?? null
  };

  if (!merged.itemId && !merged.editUrl) {
    return null;
  }

  const fieldPathAttr = element.getAttribute(FIELD_PATH_ATTR);
  const fieldPath = normalizeFieldPath(fieldPathAttr ?? merged.fieldPath);

  return {
    cms: 'datocms',
    itemId: merged.itemId ?? '',
    itemTypeId: merged.itemTypeId,
    fieldPath: fieldPath ?? undefined,
    environment: merged.environment ?? null,
    locale: merged.locale ?? null,
    editUrl: merged.editUrl,
    raw: {
      source: 'explicit-tag',
      json: jsonRaw ?? null
    }
  };
}

function stringOrUndefined(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined;
}

function stringOrNull(value: unknown): string | null {
  if (value == null) {
    return null;
  }
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }
  return null;
}

function attrOr<T extends string | null | undefined>(fallback: T, element: Element, attribute: string): T {
  const raw = element.getAttribute(attribute);
  if (raw == null) {
    return fallback;
  }
  const trimmed = raw.trim();
  if (trimmed.length === 0) {
    return fallback;
  }
  return trimmed as T;
}
