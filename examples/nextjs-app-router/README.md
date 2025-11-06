# Next.js App Router example

This minimal example shows how to wire up DatoCMS Visual Editing inside a Next.js 14 App Router project.

## Key pieces

- `lib/datoClient.ts`: adds the `X-Visual-Editing` and `X-Base-Editing-Url` headers to every preview request.
- `components/PreviewVisualEditing.tsx`: tiny client component that enables visual editing and disposes the controller when preview mode deactivates.
- `app/page.tsx`: server component that fetches preview content and mounts the helper when `draftMode()` is enabled.

## Usage

1. Copy the `lib/`, `components/`, and `app/` files into your Next.js repo.
2. Set the following environment variables:
   - `DATO_API_TOKEN` (Content Delivery token)
   - `DATO_PREVIEW_API_TOKEN` (Preview Content token)
   - `NEXT_PUBLIC_DATO_BASE_EDITING_URL` (eg. `https://acme.admin.datocms.com`)
3. Enable preview (`/api/preview`) so `draftMode` flips on, then open a preview page—the component mounts overlays automatically.
