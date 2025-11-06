'use client';

import { useEffect } from 'react';
import { enableDatoVisualEditing } from 'datocms-visual-editing';

export function PreviewVisualEditing(): null {
  useEffect(() => {
    const controller = enableDatoVisualEditing({});

    return () => {
      controller.dispose();
    };
  }, []);

  return null;
}
