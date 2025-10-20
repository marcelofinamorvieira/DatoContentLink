/** Public entry point: re-export the APIs consumers rely on. */
export { enableDatoVisualEditing } from './enable.js';
export { withContentLinkHeaders } from './net/withContentLinkHeaders.js';
export { decodeStega, stripStega } from './decode/stega.js';
export { autoCleanStegaWithin, enableDatoAutoClean } from './dom/autoClean.js';
export type {
  EnableDatoVisualEditingOptions,
  VisualEditingController,
  MarkSummary,
  VisualEditingState,
  VisualEditingWarning,
  DevPanelOption
} from './types.js';
export type { DecodedInfo } from './decode/types.js';
export {
  buildEditTagAttributes,
  applyEditTagAttributes
} from './utils/tags.js';
export type { EditTagInfo, EditTagFormat } from './utils/tags.js';
export {
  stripDatoImageAlt,
  decodeDatoImageAlt,
  withDatoImageAlt
} from './utils/imageAlt.js';
export type { WithDatoImageAltResult } from './utils/imageAlt.js';
export {
  AUTO_CLEAN_ATTR,
  DATA_ATTR_EDIT_INFO,
  DATA_ATTR_ITEM_ID,
  DATA_ATTR_ITEM_TYPE_ID,
  DATA_ATTR_EDIT_URL,
  DATA_ATTR_ENV,
  DATA_ATTR_LOCALE,
  FIELD_PATH_ATTR,
  EXPLICIT_ATTRIBUTE_NAMES
} from './utils/attr.js';
export { getDatoEditInfo } from './utils/readInfo.js';
export { buildDatoDeepLink } from './link/buildDatoDeepLink.js';
export { checkStegaState } from './utils/state.js';
export type { StegaState } from './utils/state.js';
export {
  ATTR_EDIT_URL,
  ATTR_ITEM_ID,
  ATTR_ITEM_TYPE_ID,
  ATTR_ENV,
  ATTR_LOCALE,
  ATTR_GENERATED,
  GENERATED_VALUE,
  ATTR_EDIT_TARGET,
  ATTR_EDITABLE,
  EDIT_ATTRS,
  ATTR_DEBUG,
  ATTR_DEBUG_INFO,
  ATTR_DEBUG_URL,
  ATTR_DEBUG_REASON,
  DEBUG_ATTRS,
  EVENT_READY,
  EVENT_MARKED,
  EVENT_STATE,
  EVENT_WARN
} from './constants.js';
