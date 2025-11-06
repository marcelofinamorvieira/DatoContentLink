import React from 'react';
import Image, { type ImageProps } from 'next/image';
import { decodeStega, stripStega } from 'datocms-visual-editing';

type VisualImageProps = ImageProps & {
  datoEditUrl?: string;
};

/**
 * Next.js example: normalise the DatoCMS alt payload and forward edit metadata.
 */
export function DatoImage(props: VisualImageProps) {
  const { alt, ...rest } = props;
  const cleanedAlt = typeof alt === 'string' ? stripStega(alt) : alt ?? '';
  const editInfo = typeof alt === 'string' ? decodeStega(alt) : null;

  return (
    <Image
      {...rest}
      alt={cleanedAlt}
      data-datocms-edit-url={editInfo?.editUrl ?? props.datoEditUrl}
    />
  );
}

/**
 * Development helper: surface a subtle badge next to the image that jumps to the editor.
 */
export function DatoImageDebugBadge({ alt }: { alt: string }) {
  const editInfo = decodeStega(alt);
  if (!editInfo || process.env.NODE_ENV === 'production') {
    return null;
  }
  return (
    <a
      href={editInfo.editUrl}
      target="_blank"
      rel="noreferrer"
      data-datocms-edit-url={editInfo.editUrl}
      style={{ marginLeft: 8, fontSize: '0.75rem' }}
    >
      Edit image
    </a>
  );
}
