export type MarkSummary = {
  /** Total editable targets (explicit + generated) within the processed scope. */
  editableTotal: number;
  /** Generated targets stamped during this pass. */
  generatedStamped: number;
  /** Generated targets whose attributes were updated during this pass. */
  generatedUpdated: number;
  /** Explicit editables (non-generated) within the scope. */
  explicitTotal: number;
  /** Scope root processed for this summary. */
  scope: ParentNode;
};

export type VisualEditingState = {
  enabled: boolean;
  disposed: boolean;
};

export type VisualEditingWarning = {
  code: string;
  message: string;
};

export type VisualEditingEvents = {
  onReady?: (summary: MarkSummary) => void;
  onMarked?: (summary: MarkSummary) => void;
  onStateChange?: (state: VisualEditingState) => void;
  onWarning?: (warning: VisualEditingWarning) => void;
};

export type DevPanelOption =
  | boolean
  | {
      position?: 'br' | 'bl' | 'tr' | 'tl';
    };

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
  /**
   * Render a floating development panel with live counters (development only).
   */
  devPanel?: DevPanelOption;
} & VisualEditingEvents;

export type VisualEditingController = {
  enable(): void;
  disable(): void;
  toggle(): void;
  dispose(): void;
  isEnabled(): boolean;
  isDisposed(): boolean;
  /**
   * Re-run stega marking for the entire root or a specific subtree.
   */
  refresh(root?: ParentNode): void;
};
