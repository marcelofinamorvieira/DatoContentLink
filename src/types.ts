/**
 * Shared TypeScript types exported alongside the runtime entry points. Keeping
 * them in one place helps consumers understand the public surface area.
 */
import type { DecodedInfo } from './decode/types.js';

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
   * Customize how the clickable overlay URL is resolved.
   * Receives the decoded stega payload and should return the URL to open.
   * Return null to skip stamping for that payload.
   */
  resolveEditUrl?: (info: DecodedInfo, context: { baseEditingUrl: string; environment?: string }) => string | null;
};

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
