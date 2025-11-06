/**
 * Helpers for generating or applying explicit edit tags on server-rendered
 * markup. While the runtime now stamps minimal attributes, these utilities
 * remain valuable for projects that annotate HTML ahead of time.
 */
import { DATA_ATTR_EDIT_URL, EXPLICIT_ATTRIBUTE_NAMES } from './attr.js';
import { trimmedOrUndefined } from './string.js';

export type EditTagInfo = {
  editUrl?: string;
};

/**
 * Create the attributes that should be stamped on an element to expose edit
 * metadata. Only the edit URL is supported to keep the DOM markers stable.
 */
export function buildEditTagAttributes(
  info: EditTagInfo,
): Record<string, string> {
  const cleanedEditUrl = trimmedOrUndefined(info.editUrl);
  if (!cleanedEditUrl) {
    return {};
  }

  return {
    [DATA_ATTR_EDIT_URL]: cleanedEditUrl
  };
}

/**
 * Helper that removes previous explicit attributes and applies the new set.
 * Keeps attribute churn minimal so the DOM stays predictable.
 */
export function applyEditTagAttributes(
  element: Element,
  info: EditTagInfo
): void {
  for (const name of EXPLICIT_ATTRIBUTE_NAMES) {
    element.removeAttribute(name);
  }

  const attrs = buildEditTagAttributes(info);
  for (const [name, value] of Object.entries(attrs)) {
    element.setAttribute(name, value);
  }
}

