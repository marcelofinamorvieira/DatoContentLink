'use client';

import { useEffect } from 'react';
import { enableDatoVisualEditing } from 'datocms-visual-editing';

type PreviewVisualEditingProps = {
  baseEditingUrl: string;
  environment?: string;
};

export function PreviewVisualEditing({ baseEditingUrl, environment }: PreviewVisualEditingProps) {
  useEffect(() => {
    const disposeVisualEditing = enableDatoVisualEditing({
      baseEditingUrl,
      environment,
      activate: 'always',
      overlays: 'hover',
      targetAttribute: 'data-datocms-edit-target'
    });

    return () => {
      disposeVisualEditing?.();
    };
  }, [baseEditingUrl, environment]);

  return null;
}
