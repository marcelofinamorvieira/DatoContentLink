import { ATTR_GENERATED, GENERATED_VALUE } from '../constants.js';

/**
 * Resolve the document associated with the provided root node. Falls back to
 * the global document when available and returns null in non-DOM environments.
 */
export function resolveDocument(root: ParentNode): Document | null {
  const docCtor = typeof Document !== 'undefined' ? Document : undefined;
  const globalDoc = typeof document !== 'undefined' ? document : undefined;

  if (docCtor && root instanceof docCtor) {
    return root as Document;
  }

  return root.ownerDocument ?? globalDoc ?? null;
}

/**
 * Whether the element already carries the generated attribute stamped by the
 * visual editing runtime.
 */
export function hasGeneratedAttribute(el: Element): boolean {
  return el.getAttribute(ATTR_GENERATED) === GENERATED_VALUE;
}

/**
 * Apply a set of attributes to the element, returning true when any value
 * changed.
 */
export function setAttributesIfChanged(el: Element, attrs: Record<string, string>): boolean {
  let changed = false;
  for (const [key, value] of Object.entries(attrs)) {
    if (el.getAttribute(key) !== value) {
      el.setAttribute(key, value);
      changed = true;
    }
  }
  return changed;
}

