export type EnableDatoVisualEditingOptions = {
  baseEditingUrl: string;
  environment?: string;
  root?: ParentNode;
  /**
   * Enable DOM-debug attributes on editable targets.
   * Default: false.
   */
  debug?: boolean;
};
