import { ATTR_EDIT_URL } from '../constants.js';

export type Target = {
  el: Element;
  editUrl: string;
};

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
