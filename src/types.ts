export type EnableDatoVisualEditingOptions = {
  baseEditingUrl: string;
  environment?: string;
  root?: ParentNode;
  /**
   * Enable DOM-debug attributes on editable targets.
   * Default: false.
   */
  debug?: boolean;
  /**
   * Automatically start the visual editing observers on creation.
   * Default: true.
   */
  autoEnable?: boolean;
};

export type VisualEditingController = {
  enable(): void;
  disable(): void;
  toggle(): void;
  dispose(): void;
  isEnabled(): boolean;
  isDisposed(): boolean;
};
