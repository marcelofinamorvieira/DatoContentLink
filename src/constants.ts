/**
 * Shared DOM attribute names and event identifiers used by the visual editing runtime.
 * Keeping them centralized avoids typos and makes it clear which markers the SDK
 * writes to the page when stamping editable regions.
 */
export const ATTR_EDIT_URL = 'data-datocms-edit-url';
export const ATTR_GENERATED = 'data-datocms-generated';
export const GENERATED_VALUE = 'stega';
export const ATTR_EDIT_TARGET = 'data-datocms-edit-target';
export const ATTR_EDITABLE = 'data-datocms-editable';

/**
 * Custom events used to surface lifecycle changes to host applications.
 */
export const EVENT_READY = 'datocms:visual-editing:ready';
export const EVENT_MARKED = 'datocms:visual-editing:marked';
export const EVENT_STATE = 'datocms:visual-editing:state';
export const EVENT_WARN = 'datocms:visual-editing:warn';

export const ATTR_DEBUG = 'data-datocms-debug';
export const ATTR_DEBUG_INFO = 'data-datocms-debug-info';
export const ATTR_DEBUG_URL = 'data-datocms-debug-url';
export const ATTR_DEBUG_REASON = 'data-datocms-debug-reason';

/**
 * Attribute buckets that we frequently add/remove together.
 */
export const EDIT_ATTRS = [ATTR_EDIT_URL] as const;

export const DEBUG_ATTRS = [
  ATTR_DEBUG,
  ATTR_DEBUG_INFO,
  ATTR_DEBUG_URL,
  ATTR_DEBUG_REASON
] as const;
