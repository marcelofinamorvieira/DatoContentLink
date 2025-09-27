import { DATA_ATTR_ALLOW_FOLLOW, DATA_ATTR_CLICK_CONFLICT } from './attr.js';
import { isHTMLElement } from './guards.js';

const NATIVE_INTERACTIVE_TAGS = new Set([
  'BUTTON',
  'SELECT',
  'TEXTAREA',
  'SUMMARY'
]);

const INPUT_INTERACTIVE_TYPES = new Set([
  'button',
  'submit',
  'reset',
  'checkbox',
  'radio',
  'file',
  'image',
  'color',
  'range'
]);

const POINTER_CURSOR = 'pointer';

export type ClickConflictOverride = 'prompt' | 'prefer-page' | 'prefer-dato' | 'ignore';

export function isNativeInteractive(el: Element): boolean {
  if (!isHTMLElement(el)) {
    return false;
  }

  const tag = el.tagName;

  if (tag === 'A') {
    return typeof (el as HTMLAnchorElement).href === 'string' && (el as HTMLAnchorElement).href.length > 0;
  }

  if (tag === 'INPUT') {
    const type = (el as HTMLInputElement).type?.toLowerCase() ?? '';
    if (type === 'hidden') {
      return false;
    }
    if (!type) {
      return true;
    }
    return INPUT_INTERACTIVE_TYPES.has(type);
  }

  if (tag === 'DETAILS') {
    return true;
  }

  if (NATIVE_INTERACTIVE_TAGS.has(tag)) {
    return true;
  }

  if ((el as HTMLElement).isContentEditable) {
    return true;
  }

  return false;
}

export function hasInlineClick(el: Element): boolean {
  return isHTMLElement(el) && el.hasAttribute('onclick');
}

export function hasRoleButton(el: Element): boolean {
  if (!isHTMLElement(el)) {
    return false;
  }

  const role = el.getAttribute('role');
  if (!role || role.toLowerCase() !== 'button') {
    return false;
  }

  if (el.tabIndex >= 0) {
    return true;
  }

  const tabIndexAttr = el.getAttribute('tabindex');
  if (!tabIndexAttr) {
    return false;
  }

  const parsed = Number.parseInt(tabIndexAttr, 10);
  return Number.isFinite(parsed) && parsed >= 0;
}

export function isFocusable(el: Element): boolean {
  if (!isHTMLElement(el)) {
    return false;
  }

  if (el.tabIndex >= 0) {
    return true;
  }

  const tabIndexAttr = el.getAttribute('tabindex');
  if (tabIndexAttr) {
    const parsed = Number.parseInt(tabIndexAttr, 10);
    if (Number.isFinite(parsed) && parsed >= 0) {
      return true;
    }
  }

  if (typeof el.getAttribute === 'function') {
    if (el.hasAttribute('contenteditable')) {
      return true;
    }
  }

  return false;
}

function hasPointerCursor(el: Element): boolean {
  if (!isHTMLElement(el)) {
    return false;
  }

  const style = window.getComputedStyle(el);
  return style.cursor === POINTER_CURSOR;
}

export function findInteractiveAncestor(from: Element | null): HTMLElement | null {
  let current: Element | null = from;

  while (current && current !== document.documentElement && current !== document.body) {
    if (isHTMLElement(current)) {
      if (
        isNativeInteractive(current) ||
        hasInlineClick(current) ||
        hasRoleButton(current) ||
        isFocusable(current)
      ) {
        return current;
      }
    }

    current = current.parentElement;
  }

  current = from;
  while (current && current !== document.documentElement && current !== document.body) {
    if (hasPointerCursor(current)) {
      return isHTMLElement(current) ? current : null;
    }
    current = current.parentElement;
  }

  return null;
}

export function readClickConflictOverride(element: Element | null): ClickConflictOverride | null {
  let current: Element | null = element;

  while (current && current !== document.documentElement && current !== document.body) {
    if (current.hasAttribute(DATA_ATTR_ALLOW_FOLLOW)) {
      return 'prefer-page';
    }

    const value = current.getAttribute(DATA_ATTR_CLICK_CONFLICT);
    if (value) {
      const normalized = value.trim().toLowerCase();
      if (normalized === 'prompt' || normalized === 'prefer-page' || normalized === 'prefer-dato' || normalized === 'ignore') {
        return normalized as ClickConflictOverride;
      }
    }

    current = current.parentElement;
  }

  return null;
}
