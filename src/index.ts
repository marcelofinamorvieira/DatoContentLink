/** Public entry point: re-export the APIs consumers rely on. */
export { enableDatoVisualEditing } from './enable.js';
export { withContentLinkHeaders } from './net/withContentLinkHeaders.js';
export { decodeStega, stripStega } from './decode/stega.js';
export { enableDatoAutoClean } from './dom/autoClean.js';
export type {
  EnableDatoVisualEditingOptions,
  VisualEditingController,
  MarkSummary,
  VisualEditingState,
  VisualEditingWarning
} from './types.js';
export type { DecodedInfo } from './decode/types.js';
export { buildEditTagAttributes } from './utils/tags.js';
export type { EditTagInfo, EditTagFormat } from './utils/tags.js';
export { getDatoEditInfo } from './utils/readInfo.js';
export { checkStegaState } from './utils/state.js';
export type { StegaState } from './utils/state.js';
