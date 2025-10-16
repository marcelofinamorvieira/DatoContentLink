export const ATTR_EDIT_URL = 'data-datocms-edit-url';
export const ATTR_ITEM_ID = 'data-datocms-item-id';
export const ATTR_ITEM_TYPE_ID = 'data-datocms-item-type-id';
export const ATTR_ENV = 'data-datocms-environment';
export const ATTR_LOCALE = 'data-datocms-locale';
export const ATTR_GENERATED = 'data-datocms-generated';
export const GENERATED_VALUE = 'stega';
export const ATTR_EDIT_TARGET = 'data-datocms-edit-target';
export const ATTR_EDITABLE = 'data-datocms-editable';

export const EVENT_READY = 'datocms:visual-editing:ready';
export const EVENT_MARKED = 'datocms:visual-editing:marked';
export const EVENT_STATE = 'datocms:visual-editing:state';
export const EVENT_WARN = 'datocms:visual-editing:warn';

export const ATTR_DEBUG = 'data-datocms-debug';
export const ATTR_DEBUG_INFO = 'data-datocms-debug-info';
export const ATTR_DEBUG_URL = 'data-datocms-debug-url';
export const ATTR_DEBUG_REASON = 'data-datocms-debug-reason';

export const EDIT_ATTRS = [
  ATTR_EDIT_URL,
  ATTR_ITEM_ID,
  ATTR_ITEM_TYPE_ID,
  ATTR_ENV,
  ATTR_LOCALE
] as const;

export const DEBUG_ATTRS = [
  ATTR_DEBUG,
  ATTR_DEBUG_INFO,
  ATTR_DEBUG_URL,
  ATTR_DEBUG_REASON
] as const;
