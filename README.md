# datocms-visual-editing

## Quick Setup Guide

1. **Install the package.**
   ```bash
   pnpm add datocms-visual-editing
   ```

2. **Fetch preview content with headers enabled.**
   ```ts
   import { withContentLinkHeaders } from 'datocms-visual-editing';

   const fetchWithHeaders = withContentLinkHeaders(fetch);
   const data = await fetchWithHeaders('https://graphql.datocms.com/', {
     method: 'POST',
     headers: {
       Authorization: `Bearer ${process.env.DATO_CDA_TOKEN}`,
       'Content-Type': 'application/json',
       'X-Base-Editing-Url': 'https://acme.admin.datocms.com'
     },
     body: JSON.stringify({ query })
   });
   ```

3. **Enable overlays in your preview bundle.**
   ```ts
   import { enableDatoVisualEditing } from 'datocms-visual-editing';

   enableDatoVisualEditing({
     baseEditingUrl: 'https://acme.admin.datocms.com',
     activate: 'query',       // ?edit=1 turns it on by default
     overlays: 'hover'
   });
   ```

4. **(Optional) Mark up large cards.** Wrap card containers with `data-datocms-edit-target` so the whole card highlights, not just the text node.

That’s it—hover or click the decoded content in your preview build to jump straight to the matching record inside DatoCMS.

Click-to-edit overlays for content rendered from DatoCMS stega metadata—no Vercel toolbar required. Drop the tiny ES module into any preview build, decode the hidden payloads, and jump straight to the right record + field inside the DatoCMS editor.

```
DatoCMS GraphQL → content with hidden markers → overlay → Dato editor deep link
```

## How it works

```
┌──────────────┐      X-Visual-Editing headers      ┌───────────────┐
│  Your site   │ ─────────────────────────────────▶ │ DatoCMS CDA    │
└──────┬───────┘                                     └──────┬────────┘
       │ cleaned text + @vercel/stega markers                │
       ▼                                                     ▼
┌──────────────┐   decode + map ids   ┌────────────────────┐  Deep link with
│ Visual layer │ ───────────────────▶ │ enableDatoVisual…() │ ───────────────▶
└──────┬───────┘   overlays + badge   └────────────────────┘  #fieldPath hash
       │
       ▼
   DatoCMS editor opens at the exact record + field
```

Under the hood we:

1. Require the two Dato headers so the Content Delivery API embeds `@vercel/stega` metadata in strings and image alts.
2. Decode the payload client-side (MPL-2.0 `@vercel/stega` dependency) into `itemId`, `itemTypeId`, `fieldPath`, etc.
3. Draw unobtrusive overlays above the matching DOM nodes (or custom containers) and wire click/keyboard handlers that deep link to the admin UI with `#fieldPath=`.

## Installation

```bash
pnpm add datocms-visual-editing
# or
npm install datocms-visual-editing
```

Target Node ≥ 18 / evergreen browsers. The package ships ESM-only output in `dist/` and has no runtime dependencies besides `@vercel/stega`.

## Getting stega metadata from DatoCMS

Enable the headers on every GraphQL request that powers your preview surface:

```ts
import { withContentLinkHeaders } from 'datocms-visual-editing';

const fetchWithHeaders = withContentLinkHeaders(fetch);
await fetchWithHeaders('https://graphql.datocms.com/', {
  method: 'POST',
  headers: {
    Authorization: `Bearer ${process.env.DATO_CDA_TOKEN}`,
    'Content-Type': 'application/json',
    'X-Base-Editing-Url': 'https://acme.admin.datocms.com'
  },
  body: JSON.stringify({ query })
});
```

Adapters:

- `graphql-request` client:
  ```ts
  import { GraphQLClient } from 'graphql-request';
  import { withContentLinkHeaders } from 'datocms-visual-editing';

  const rawFetch = withContentLinkHeaders(fetch);

  const client = new GraphQLClient(endpoint, {
    fetch: rawFetch,
    headers: {
      Authorization: `Bearer ${token}`,
      'X-Base-Editing-Url': 'https://acme.admin.datocms.com'
    }
  });
  ```
- Apollo Link:
  ```ts
  import { setContext } from '@apollo/client/link/context';

  const contentLinkHeaders = setContext((_, { headers }) => ({
    headers: {
      ...headers,
      'X-Visual-Editing': 'vercel-v1',
      'X-Base-Editing-Url': 'https://acme.admin.datocms.com'
    }
  }));
  ```

## Usage in the browser

```ts
import { enableDatoVisualEditing } from 'datocms-visual-editing';

enableDatoVisualEditing({
  baseEditingUrl: 'https://acme.admin.datocms.com',
  activate: 'query',           // default: ?edit=1 toggles on
  overlays: 'hover',           // 'always' | 'hover' | 'off'
  showBadge: true,             // tiny “Open in DatoCMS” badge
  targetAttribute: 'data-datocms-edit-target',
  hitPadding: 8,               // forgive near-miss hovers (per side, px)
  minHitSize: 20,              // optional minimum overlay size
  hoverLingerMs: 120,          // keeps overlays visible briefly when skimming edges
  openInNewTab: true
});
```

The initializer returns a disposer if you need to tear everything down (SPA route change, etc.).

### Activation strategies

| Mode            | Description                                                             |
|-----------------|-------------------------------------------------------------------------|
| `always`        | Force-enable (preview deployments).                                     |
| `query` (default)| Checks `?edit=1` (customizable via `activationQueryParam`).            |
| `localStorage`  | Reads a toggle key (default `datocms:ve === '1'`).                       |
| function        | Pass a custom `(window) => boolean` predicate.                          |

### Overlay controls

- `targetAttribute`: Place `data-datocms-edit-target` on a container to highlight the entire card while still decoding stega hidden inside a child node. Existing `data-vercel-edit-target` hooks are honoured too.
- `hitPadding` (default `8`): inflate hover/click geometry so the pointer can drift slightly outside the glyphs or image and still count as “on the card”. Accepts a number or `{ x, y }` / directional object.
- `minHitSize` (default `0`): guarantee a minimum overlay size (useful for tiny inline strings). Pass a number or `{ width, height }`.
- `hoverLingerMs` (default `100`): hold the overlay on screen for a short time when the pointer leaves a target to avoid flicker.
- `mergeSegments` (default `'proximity'`): merge per-line text rectangles. Set to `'always'` for a single box or `'never'` to keep discrete segments.
- `mergeProximity` (default `6`): distance (in px or `EdgePadding` object) used when `mergeSegments: 'proximity'` to decide whether adjacent boxes should be merged.
- `showBadge`: toggle the badge. When enabled, it’s clickable + keyboard accessible (`Enter` / `Space`).
- Respect for `prefers-reduced-motion` disables outline animations automatically.

### Debug mode

Flip on verbose logging during preview/debug sessions:

```ts
enableDatoVisualEditing({
  baseEditingUrl: 'https://acme.admin.datocms.com',
  activate: 'always',
  debug: true
});
```

Every overlay click outputs a `[datocms-visual-editing][debug] overlay click` entry with the resolved URL, decoded metadata, and the highlighted DOM node. Handy when verifying that your field paths, environments, and custom `onResolveUrl` logic line up with expectations.

### Stega clean-up resilience

Frameworks such as Next.js strip the hidden stega markers shortly after hydration. By default (`persistAfterClean: true`) the observer keeps the decoded metadata alive as long as the visible text/alt string stays the same, so overlays remain clickable even after the cleanup. Disable this behaviour by passing `persistAfterClean: false` if you prefer to require markers at all times.

### Deep link behaviour

- If a stega payload already carries an `editUrl` that matches your `baseEditingUrl` origin, the overlay reuses it verbatim so editor tabs, locales, and `#fieldPath` hashes stay intact.
- Otherwise we build the URL from `baseEditingUrl`, optional `environment`, `itemTypeId`, and `itemId`, and append the normalized `fieldPath` (when available) as `#fieldPath=`.
- Trim trailing slashes from `baseEditingUrl` (for example store `https://acme.admin.datocms.com` instead of the version with a trailing `/`) to avoid doubled slashes in the generated deep links.

## Field targeting tips

- DatoCMS exposes `#fieldPath=` anchors in the editor—payloads from stega already include them for structured text spans and modular content. You can override or augment the path by decorating any ancestor with `data-datocms-field-path="blocks.0.title"`.
- Keep overlay positioning accurate by avoiding large `letter-spacing` tweaks in preview modes. If you must, call `stripStega()` on the string before measuring text widths.

## Non-text fields and complex text fields

DatoCMS only appends visual-editing metadata to:

- **Plain text fields** (single-line or multi-line without special validation).
- **Structured Text** nodes (metadata rides on the final text span of the first block rendered).
- **Image `alt` strings** returned with each upload.

Numbers, booleans, slugs, coordinates, JSON blobs, counters, icons, SVGs, background images, etc., do **not** carry stega markers automatically. Use explicit edit tags to opt those elements into overlays:

```html
<!-- Minimal JSON tag -->
<span
  data-datocms-edit-info='{
    "itemId": "123",
    "itemTypeId": "123456",
    "fieldPath": "price",
    "locale": "en"
  }'
  data-datocms-edit-target
>
  129.00
</span>

<!-- Minimal JSON tag when you already have _editingUrl -->
<span
  data-datocms-edit-info='{
    "editUrl": "https://acme.admin.datocms.com/editor/item_types/123456/items/789/edit#fieldPath=gallery.0.alt",
    "locale": "en"
  }'
  data-datocms-edit-target
>
  <img src="/gallery.jpg" alt="Gallery item" />
</span>

<!-- Split attributes (no inline JSON) -->
<div
  data-datocms-item-id="123"
  data-datocms-item-type-id="123456"
  data-datocms-field-path="seo.title"
  data-datocms-locale="en"
  data-datocms-edit-target
>
  <svg aria-hidden="true" class="icon icon--edit"></svg>
</div>
```

Always include the locale—either in the JSON payload or via the `data-datocms-locale` attribute—so overlays can open the correct localized field in the editor. Keep `fieldPath` segments snake_case to match the editor anchors (`sale_price.en`, not `salePrice.en`).

In React/JS you can generate the attributes with `buildEditTagAttributes`:

```tsx
import { buildEditTagAttributes } from 'datocms-visual-editing';

export function Price({ itemId, amount }: { itemId: string; amount: number }) {
  const attrs = buildEditTagAttributes({
    itemId,
    itemTypeId: '123456',
    fieldPath: 'price',
    locale: 'en'
  });
  return (
    <span {...attrs} data-datocms-edit-target>
      {amount.toFixed(2)}
    </span>
  );
}
```

The `itemTypeId` value must be the model's internal numeric ID from DatoCMS (for example `123456`), not the API identifier such as `product`.

If your GraphQL query includes the `_editingUrl` field you can pass it directly:

```tsx
const attrs = buildEditTagAttributes({
  _editingUrl: data.product._editingUrl,
  fieldPath: ['seo', 'title'],
  locale: "en"
});
```

When `_editingUrl` is provided the helper appends the normalized `fieldPath` to the URL and can omit both `itemId` and `itemTypeId`.

```tsx
const attrs = buildEditTagAttributes({ fieldPath: 'sale_price', locale: 'en' });
// payload.fieldPath === 'sale_price.en'
```

**Always supply a `locale`.** The overlays rely on it to route clicks to the correct localized value; the helper appends it to the resolved field path (without duplicating it) and rewrites any existing `editUrl` hash so the editor opens the localized field.

`data-datocms-field-path` (if present) overrides any `fieldPath` provided via JSON or split attributes.
When you call `buildEditTagAttributes(info, 'attrs')`, set `data-datocms-field-path` separately if you need a specific tab/anchor in the editor.

### Images not showing overlays?

1. **Ensure the `<img>` has a non-empty `alt`.** The CDA only appends stega markers to strings; if the alt is empty (or replaced), there’s nothing to decode.
2. **Hydration cleanup.** Frameworks sometimes strip markers right after hydration. The observer keeps matches alive when `persistAfterClean` is `true` (default) as long as the visible `alt` text stays the same.
3. **Lazy/zero-sized images.** When the image itself measures `0×0`, tag the wrapper with `data-datocms-edit-target`; geometry falls back to the container.
4. **Background or decorative imagery.** Use explicit tags, e.g.:

```html
<figure
  style="background-image:url(/hero.jpg)"
  data-datocms-edit-info='{"itemId":"asset_987","fieldPath":"hero.alt"}'
  data-datocms-edit-target
></figure>
```

## API surface

| Export | Description |
|--------|-------------|
| `enableDatoVisualEditing(opts)` | Mounts the visual layer and returns a disposer. |
| `withContentLinkHeaders(fetch?)` | Wraps `fetch` to inject `X-Visual-Editing` + verify `X-Base-Editing-Url`. |
| `decodeStega(text)` | Returns normalized `DecodedInfo` (`itemId`, `itemTypeId`, `fieldPath`, etc.) or `null`. |
| `stripStega(text)` | Removes hidden characters so you can measure text without re-rendering. |
| `buildEditTagAttributes(info, format?)` | Returns the `data-datocms-*` attrs needed to opt-in overlays for non-text elements. |
| `applyEditTagAttributes(element, info, format?)` | Imperatively stamp the same attributes onto a DOM node. |

Always provide a `locale` to `buildEditTagAttributes` and `buildDatoDeepLink`; both helpers append the locale segment to the resolved `fieldPath` and ensure the `#fieldPath` hash in the edit URL points at the localized value.

### `onResolveUrl` hook

You can intercept every decoded payload and swap the destination URL:

```ts
enableDatoVisualEditing({
  baseEditingUrl: 'https://acme.admin.datocms.com',
  activate: 'always',
  onResolveUrl(info) {
    if (info.fieldPath?.startsWith('seo.')) {
      return `${info.editUrl ?? 'https://acme.admin.datocms.com/editor/items/' + info.itemId + '/edit'}#tab=seo`;
    }
    return null; // skip overlay if you can’t build a safe URL
  }
});
```

Return `null` to disable overlays for that payload.

## Examples

- `examples/plain-js/index.html`: minimal script tag that fetches GraphQL with the headers, renders structured text, and activates overlays when `?edit=1` is present.
- `examples/nextjs-app-router/`: Next.js 14 App Router demo showing how to restrict `enableDatoVisualEditing` to preview mode and wrap cards with `data-datocms-edit-target` for larger hitboxes.

## Troubleshooting

- **No overlays showing** – Double check the headers, ensure `baseEditingUrl` matches your project (and environment), and verify the activation toggle.
- **Badge/outline misaligned** – Overlay dimensions come from the nearest container with `data-datocms-edit-target`; add the attribute around a stable wrapper or strip stega characters before custom measurements.
- **Navigation blocked** – Use `onBeforeOpen((url, event) => boolean)` to permit or cancel the editor jump on a per-click basis.

## Contributing & testing

```bash
pnpm install
pnpm build
pnpm test
```

Vitest + jsdom cover decoding, deep-link building, and DOM behaviors.

## Licensing

The project itself is MIT licensed (see `LICENSE`). It bundles `@vercel/stega` under MPL-2.0—details live in `LICENSES.md`.
