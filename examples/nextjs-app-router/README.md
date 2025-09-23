# Next.js App Router example

This minimal example shows how to wire up DatoCMS Visual Editing inside a Next.js 14 App Router project.

## Key pieces

- `lib/datoClient.ts`: wraps `fetch` with `withContentLinkHeaders` so every preview query sends the required headers.
- `components/PreviewVisualEditing.tsx`: tiny client component that calls `enableDatoVisualEditing` when preview mode is active.
- `app/page.tsx`: server component that fetches preview content and mounts the helper when `draftMode()` is enabled.

## Usage

1. Copy the `lib/`, `components/`, and `app/` files into your Next.js repo.
2. Set the following environment variables:
   - `DATO_API_TOKEN` (Content Delivery token)
   - `DATO_PREVIEW_API_TOKEN` (Preview Content token)
   - `NEXT_PUBLIC_DATO_BASE_EDITING_URL` (eg. `https://acme.admin.datocms.com`)
3. Enable preview (`/api/preview`) so `draftMode` flips on, then open a page with `?edit=1`.

Because `PreviewVisualEditing` forces `activate: 'always'`, overlays only mount when the component renders (ie. in preview pages). Adjust to taste if you prefer URL or localStorage toggles.
