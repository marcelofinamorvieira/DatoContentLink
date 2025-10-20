/**
 * Low-level DOM mutation helpers used when stamping or cleaning up editable
 * markers. The logic stays here so both stega and explicit workflows share
 * the exact same attribute semantics.
 */
import {
  ATTR_EDIT_URL,
  ATTR_ITEM_ID,
  ATTR_ITEM_TYPE_ID,
  ATTR_ENV,
  ATTR_LOCALE,
  ATTR_GENERATED,
  GENERATED_VALUE,
  EDIT_ATTRS,
  ATTR_EDITABLE,
  ATTR_DEBUG,
  ATTR_DEBUG_INFO,
  ATTR_DEBUG_URL,
  ATTR_DEBUG_REASON,
  DEBUG_ATTRS
} from '../constants.js';

/**
 * Minimal payload required to stamp an element as editable. Today we only keep
 * the edit URL, but the structure is future-proof if we re-introduce metadata.
 */
export type EditInfo = {
  editUrl: string;
  itemId?: string;
  itemTypeId?: string;
  environment?: string;
  locale?: string;
};

const warnedCollisionElements = new WeakSet<Element>();

/**
 * Write edit markers to the target element, returning true when any attribute
 * changed (useful for analytics or follow-up debug work).
 */
export function stampAttributes(el: Element, info: EditInfo): boolean {
  if (el.hasAttribute(ATTR_EDIT_URL) && el.getAttribute(ATTR_GENERATED) !== GENERATED_VALUE) {
    return false;
  }

  const existingGenerated = el.getAttribute(ATTR_GENERATED) === GENERATED_VALUE;
  const existingUrl = el.getAttribute(ATTR_EDIT_URL);

  if (existingGenerated && existingUrl && existingUrl !== info.editUrl) {
    warnCollision(el, existingUrl, info.editUrl);
  }

  const next: Record<string, string> = {
    [ATTR_EDIT_URL]: info.editUrl
  };

  let changed = false;

  for (const [key, value] of Object.entries(next)) {
    if (el.getAttribute(key) !== value) {
      el.setAttribute(key, value);
      changed = true;
    }
  }

  const removableAttrs = [ATTR_ITEM_ID, ATTR_ITEM_TYPE_ID, ATTR_ENV, ATTR_LOCALE];
  for (const attr of removableAttrs) {
    if (!(attr in next) && el.hasAttribute(attr)) {
      el.removeAttribute(attr);
      changed = true;
    }
  }

  let generatedStamped = false;
  if (!existingGenerated) {
    el.setAttribute(ATTR_GENERATED, GENERATED_VALUE);
    generatedStamped = true;
  } else if (changed) {
    el.setAttribute(ATTR_GENERATED, GENERATED_VALUE);
  }

  el.setAttribute(ATTR_EDITABLE, '');

  return changed || generatedStamped;
}

/**
 * Enrich the target element with debug metadata so the dev panel / inspectors
 * can surface details without re-running the decoder.
 */
export function stampDebugAttributes(
  el: Element,
  payload: { reason: string; url: string; infoJson: string }
): void {
  el.setAttribute(ATTR_DEBUG, 'on');
  el.setAttribute(ATTR_DEBUG_REASON, payload.reason);
  el.setAttribute(ATTR_DEBUG_URL, payload.url);
  el.setAttribute(ATTR_DEBUG_INFO, payload.infoJson);
}

/**
 * Remove all generated markers and debug payloads inside `root`. Used when
 * disabling the controller or running in environments where overlays are off.
 */
export function clearGeneratedAttributes(root: ParentNode): void {
  const debugNodes = root.querySelectorAll<HTMLElement>(
    `[${ATTR_DEBUG}], [${ATTR_DEBUG_INFO}], [${ATTR_DEBUG_REASON}], [${ATTR_DEBUG_URL}]`
  );
  debugNodes.forEach((el) => {
    for (const name of DEBUG_ATTRS) {
      el.removeAttribute(name);
    }
  });

  const nodes = root.querySelectorAll<HTMLElement>(`[${ATTR_GENERATED}="${GENERATED_VALUE}"]`);
  nodes.forEach((el) => {
    el.removeAttribute(ATTR_GENERATED);
    for (const name of EDIT_ATTRS) {
      el.removeAttribute(name);
    }
    el.removeAttribute(ATTR_EDITABLE);
  });
}

// Log (once) when two stega payloads map to the same element, which would break deep linking.
function warnCollision(el: Element, originalUrl: string, nextUrl: string): void {
  if (warnedCollisionElements.has(el)) {
    return;
  }
  warnedCollisionElements.add(el);

  const message =
    '[datocms-visual-editing] Multiple stega payloads resolved to the same DOM element. ' +
    `Previously stamped edit URL: ${originalUrl}. Incoming edit URL: ${nextUrl}. ` +
    'Wrap each encoded block in its own element (for example by adding data-datocms-edit-target).';

  console.warn(message, el);
}
