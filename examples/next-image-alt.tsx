import Image, { type ImageProps } from 'next/image';
import { withDatoImageAlt } from 'datocms-visual-editing';

type VisualImageProps = ImageProps & {
  datoEditUrl?: string;
};

/**
 * Next.js example: normalise the DatoCMS alt payload and forward edit metadata.
 */
export function DatoImage(props: VisualImageProps) {
  const { alt, ...rest } = props;
  const { cleanedAlt, editInfo } = withDatoImageAlt(alt);

  return (
    <Image
      {...rest}
      alt={cleanedAlt}
      data-datocms-edit-url={editInfo?.editUrl ?? props.datoEditUrl}
      data-datocms-item-id={editInfo?.itemId}
      data-datocms-item-type-id={editInfo?.itemTypeId}
      data-datocms-locale={editInfo?.locale ?? undefined}
    />
  );
}

/**
 * Development helper: surface a subtle badge next to the image that jumps to the editor.
 */
export function DatoImageDebugBadge({ alt }: { alt: string }) {
  const { editInfo } = withDatoImageAlt(alt);
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
      Edit {editInfo.fieldPath ?? 'image'}
    </a>
  );
}
