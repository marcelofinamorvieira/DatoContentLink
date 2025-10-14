'use client';

import { useEffect } from 'react';
import { enableDatoVisualEditing } from 'datocms-visual-editing';

type PreviewVisualEditingProps = {
  baseEditingUrl: string;
  environment?: string;
};

export function PreviewVisualEditing({ baseEditingUrl, environment }: PreviewVisualEditingProps) {
  useEffect(() => {
    const controller = enableDatoVisualEditing({
      baseEditingUrl,
      environment
    });

    return () => {
      controller.dispose();
    };
  }, [baseEditingUrl, environment]);

  return null;
}
