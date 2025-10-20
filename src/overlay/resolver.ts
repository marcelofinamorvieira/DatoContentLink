/**
 * Resolve which element should receive the overlay highlight when the pointer
 * hovers over the page. Simple wrapper, but kept isolated for testability.
 */
import { ATTR_EDIT_URL } from '../constants.js';

export type Target = {
  el: Element;
  editUrl: string;
};

/**
 * Walk up from the hovered element until we hit something stamped with
 * `data-datocms-edit-url`. Returns both the element and the URL to open.
 */
export function findEditableTarget(from: Element | null): Target | null {
  if (!from) {
    return null;
  }

  const el = from.closest<HTMLElement>(`[${ATTR_EDIT_URL}]`);
  if (!el) {
    return null;
  }

  const url = el.getAttribute(ATTR_EDIT_URL);
  if (!url) {
    return null;
  }

  return { el, editUrl: url };
}
