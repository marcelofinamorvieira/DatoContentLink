import {
  ATTR_EDIT_URL,
  ATTR_GENERATED,
  GENERATED_VALUE
} from '../constants.js';
import { readExplicitInfo } from '../utils/attr.js';
import { stampDebugAttributes } from './stamp.js';
import { fromDecoded, safeStringify } from '../utils/debug.js';

type AnnotateContext = {
  baseEditingUrl: string;
  environment?: string;
  root: ParentNode;
};

export function annotateExplicitTargetsForDebug(ctx: AnnotateContext): void {
  const scope = ctx.root as ParentNode & { querySelectorAll: typeof document.querySelectorAll };
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

    const explicit = readExplicitInfo(el);
    const payload = fromDecoded(
      'explicit',
      'attrs',
      url,
      ctx.baseEditingUrl,
      ctx.environment,
      el,
      explicit
    );

    stampDebugAttributes(el, {
      reason: 'explicit',
      url,
      infoJson: safeStringify(payload)
    });
  });
}
