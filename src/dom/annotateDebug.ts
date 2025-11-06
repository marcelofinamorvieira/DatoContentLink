/**
 * Debug helpers that annotate explicitly tagged nodes (data-datocms-*) with
 * additional metadata. This makes it easy to inspect server-stamped elements
 * even when stega payloads were not involved.
 */
import { ATTR_EDIT_URL, ATTR_GENERATED, GENERATED_VALUE, ATTR_EDITABLE } from '../constants.js';
import { readExplicitInfo } from '../utils/attr.js';
import { stampDebugAttributes } from './stamp.js';
import { fromDecoded, safeStringify } from '../utils/debug.js';

/**
 * Ensure explicitly tagged elements surface debug metadata in dev mode.
 * Generated nodes already have this info, so we skip them here.
 */
export function annotateExplicitTargetsForDebug(root: ParentNode): void {
  const scope = root as ParentNode & { querySelectorAll: typeof document.querySelectorAll };
  const nodes = scope.querySelectorAll<HTMLElement>(`[${ATTR_EDIT_URL}]`);

  nodes.forEach((el) => {
    const url = el.getAttribute(ATTR_EDIT_URL);
    if (!url) {
      return;
    }

    const generated = el.getAttribute(ATTR_GENERATED) === GENERATED_VALUE;
    if (generated) {
      return;
    }

    el.setAttribute(ATTR_EDITABLE, '');

    const explicit = readExplicitInfo(el);
    const payload = fromDecoded('explicit', 'attrs', url, el, explicit);

    stampDebugAttributes(el, {
      reason: 'explicit',
      url,
      infoJson: safeStringify(payload)
    });
  });
}
