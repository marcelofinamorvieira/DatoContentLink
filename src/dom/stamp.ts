import {
  ATTR_EDIT_URL,
  ATTR_ITEM_ID,
  ATTR_ITEM_TYPE_ID,
  ATTR_ENV,
  ATTR_LOCALE,
  ATTR_GENERATED,
  GENERATED_VALUE,
  EDIT_ATTRS,
  ATTR_DEBUG,
  ATTR_DEBUG_INFO,
  ATTR_DEBUG_URL,
  ATTR_DEBUG_REASON,
  DEBUG_ATTRS
} from '../constants.js';

export type EditInfo = {
  editUrl: string;
  itemId?: string;
  itemTypeId?: string;
  environment?: string;
  locale?: string;
};

const warnedCollisionElements = new WeakSet<Element>();

export function stampAttributes(el: Element, info: EditInfo): void {
  if (el.hasAttribute(ATTR_EDIT_URL) && el.getAttribute(ATTR_GENERATED) !== GENERATED_VALUE) {
    return;
  }

  const existingGenerated = el.getAttribute(ATTR_GENERATED) === GENERATED_VALUE;
  const existingUrl = el.getAttribute(ATTR_EDIT_URL);

  if (existingGenerated && existingUrl && existingUrl !== info.editUrl) {
    warnCollision(el, existingUrl, info.editUrl);
  }

  const next: Record<string, string> = {
    [ATTR_EDIT_URL]: info.editUrl
  };

  if (info.itemId) {
    next[ATTR_ITEM_ID] = info.itemId;
  }
  if (info.itemTypeId) {
    next[ATTR_ITEM_TYPE_ID] = info.itemTypeId;
  }
  if (info.environment) {
    next[ATTR_ENV] = info.environment;
  }
  if (info.locale) {
    next[ATTR_LOCALE] = info.locale;
  }

  let changed = false;

  for (const [key, value] of Object.entries(next)) {
    if (el.getAttribute(key) !== value) {
      el.setAttribute(key, value);
      changed = true;
    }
  }

  if (changed || !el.hasAttribute(ATTR_GENERATED)) {
    el.setAttribute(ATTR_GENERATED, GENERATED_VALUE);
  }
}

export function stampDebugAttributes(
  el: Element,
  payload: { reason: string; url: string; infoJson: string }
): void {
  el.setAttribute(ATTR_DEBUG, 'on');
  el.setAttribute(ATTR_DEBUG_REASON, payload.reason);
  el.setAttribute(ATTR_DEBUG_URL, payload.url);
  el.setAttribute(ATTR_DEBUG_INFO, payload.infoJson);
}

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
  });
}

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
