import React from 'react';
import { draftMode } from 'next/headers';
import { PreviewVisualEditing } from '../components/PreviewVisualEditing';
import { datoQuery } from '../lib/datoClient';

const HOME_QUERY = `
  query HomePage($preview: Boolean!) {
    homePage(preview: $preview) {
      title
      intro
      heroImage {
        url
        alt
      }
    }
  }
`;

type HomePageQuery = {
  homePage: {
    title: string;
    intro: string;
    heroImage: {
      url: string;
      alt: string;
    } | null;
  } | null;
};

export default async function Page() {
  const { isEnabled } = draftMode();
  const data = await datoQuery<HomePageQuery, { preview: boolean }>({
    query: HOME_QUERY,
    variables: { preview: isEnabled },
    preview: isEnabled
  });

  const baseEditingUrl = process.env.NEXT_PUBLIC_DATO_BASE_EDITING_URL!;

  return (
    <main className="mx-auto max-w-3xl space-y-6 p-8">
      {isEnabled && (
        <PreviewVisualEditing baseEditingUrl={baseEditingUrl} environment="staging" />
      )}

      <article
        className="rounded-xl border border-zinc-200 p-6 shadow-sm"
        data-datocms-edit-target
      >
        <h1 className="text-3xl font-semibold">{data.homePage?.title ?? 'Untitled'}</h1>
        <p className="text-lg text-zinc-600">{data.homePage?.intro}</p>
        {data.homePage?.heroImage && (
          <img
            className="mt-6 rounded-lg"
            src={data.homePage.heroImage.url}
            alt={data.homePage.heroImage.alt ?? ''}
            width={1200}
            height={675}
          />
        )}
      </article>
    </main>
  );
}
