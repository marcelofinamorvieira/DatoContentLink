# datocms-visual-editing

Click-to-edit overlays for content rendered from DatoCMS—**no Vercel toolbar required**.  
This tiny ESM library decodes stega metadata added by DatoCMS, draws unobtrusive overlays on your page, and deep-links straight to the exact record/field in the DatoCMS editor.

> **Requirements**
>
> - Node **≥ 18**
> - Evergreen browsers
> - Your preview build must fetch content from DatoCMS **with “visual editing” headers** (see below)

---

## Table of contents

- [Quick start (copy-paste)](#quick-start-copy-paste)
- [Concepts in 60 seconds](#concepts-in-60-seconds)
- [Step 1: Fetch content with the right headers](#step-1-fetch-content-with-the-right-headers)
- [Step 2: Turn on overlays in the browser](#step-2-turn-on-overlays-in-the-browser)
- [Step 3 (recommended): Auto-clean stega characters](#step-3-recommended-auto-clean-stega-characters)
  - [Why cleanup is needed](#why-cleanup-is-needed)
  - [How overlays keep working after cleanup](#how-overlays-keep-working-after-cleanup)
  - [Ways to run AutoClean](#ways-to-run-autoclean)
- [Images: how visual editing works for `<img>`](#images-how-visual-editing-works-for-img)
  - [Checklist for images](#checklist-for-images)
  - [When to use explicit tags (backgrounds, svgs, numbers…)](#when-to-use-explicit-tags-backgrounds-svgs-numbers)
- [Structured Text (DAST): make the whole block clickable](#structured-text-dast-make-the-whole-block-clickable)
  - [Using `react-datocms` effectively](#using-react-datocms-effectively)
  - [Common pitfalls & fixes (Structured Text)](#common-pitfalls--fixes-structured-text)
  - [FAQ for Structured Text](#faq-for-structured-text)
- [Verifying your integration](#verifying-your-integration)
- [Tuning overlays (hit area, hover, accessibility)](#tuning-overlays-hit-area-hover-accessibility)
- [Deep link behaviour](#deep-link-behaviour)
- [Recipes (GraphQL clients, Next.js, plain JS)](#recipes-graphql-clients-nextjs-plain-js)
- [API reference](#api-reference)
- [Troubleshooting](#troubleshooting)
- [License](#license)

---

## Quick start (copy-paste)

1. **Install**

   ```bash
   pnpm add datocms-visual-editing
   # or: npm i datocms-visual-editing
   ```

2. **Fetch preview content with headers**

   ```ts
   import { withContentLinkHeaders } from 'datocms-visual-editing';

   const fetchDato = withContentLinkHeaders(fetch, 'https://acme.admin.datocms.com'); // default X-Base-Editing-Url

   const res = await fetchDato('https://graphql.datocms.com/', {
     method: 'POST',
     headers: {
       Authorization: `Bearer ${process.env.DATO_CDA_TOKEN}`,
       'Content-Type': 'application/json'
     },
     body: JSON.stringify({ query })
   });
   ```

3. **Enable overlays in your preview bundle**

   ```ts
   import { enableDatoVisualEditing } from 'datocms-visual-editing';

   enableDatoVisualEditing({
     baseEditingUrl: 'https://acme.admin.datocms.com',
     activate: 'query',            // ?edit=1 enables it (see activation options)
     overlays: 'hover',
     persistAfterClean: true        // keep this on (default)
   });
   ```

4. **(Recommended) Auto-clean stega characters after hydration**

   - **React**

     ```tsx
     'use client';
     import { DatoAutoClean } from 'datocms-visual-editing/react';

     export function PreviewCard({ title, intro, image }) {
       return (
         <DatoAutoClean as="article" className="card" options={{ delayMs: 32 }}>
           <h1>{title}</h1>
           <p>{intro}</p>
           <img src={image.url} alt={image.alt ?? ''} />
         </DatoAutoClean>
       );
     }
     ```

   - **Non-React**

     ```ts
     import { enableDatoAutoClean } from 'datocms-visual-editing';

     // Cleans inside every element that has [data-datocms-auto-clean]
     enableDatoAutoClean();
     ```

Open your preview page with **`?edit=1`**. Hover/click content to jump straight to DatoCMS.

---

## Concepts in 60 seconds

**Stega metadata**: DatoCMS can embed invisible “zero-width” markers into strings (and image `alt`s). These markers carry `{ itemId, itemTypeId, fieldPath, locale, editUrl }` so the library can draw a small overlay over what you see and deep-link to the right field in the editor.

**AutoClean**: Fonts/layout can shift slightly with zero-width characters; frameworks sometimes strip them unpredictably. AutoClean removes the markers from your DOM **after** we decode them so your layout matches production while overlays keep working.

**Images**: DatoCMS encodes metadata in the **`alt`** string of `<img>` elements. Background images don’t carry metadata—you’ll use explicit tags in those cases.

---

## Step 1: Fetch content with the right headers

You must include:

- `X-Visual-Editing: vercel-v1`
- `X-Base-Editing-Url: https://<your-project>.admin.datocms.com`

Use the helper to guarantee both and avoid header drift:

```ts
import { withContentLinkHeaders } from 'datocms-visual-editing';

const fetchDato = withContentLinkHeaders(fetch, 'https://acme.admin.datocms.com'); // optional default
const data = await fetchDato('https://graphql.datocms.com/', {
  method: 'POST',
  headers: {
    Authorization: `Bearer ${process.env.DATO_CDA_TOKEN}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({ query })
});
```

> Need Node/undici streaming? Pass either `fetch(url, init)` or a pre-built `Request`—the helper forwards `init.duplex` in both cases. If `X-Base-Editing-Url` is missing, the helper throws early so you don’t debug a blank page.

Adapters:

- **graphql-request**: pass the wrapped `fetch` and the base URL header.
- **Apollo**: add the two headers via a context link.

(See [Recipes](#recipes-graphql-clients-nextjs-plain-js) for copy-paste snippets.)

---

## Step 2: Turn on overlays in the browser

```ts
import { enableDatoVisualEditing } from 'datocms-visual-editing';

enableDatoVisualEditing({
  baseEditingUrl: 'https://acme.admin.datocms.com',
  activate: 'query',        // ?edit=1 enables; ?edit=0 disables
  overlays: 'hover',        // 'hover' | 'always' | 'off'
  showBadge: true,          // small “Open in DatoCMS” badge
  openInNewTab: true        // opens with noopener,noreferrer for safety
});
```

**Activation options**

- `'query'` *(default)* – `?edit=1` → on, `?edit=0|false|off` → off.
- `'localStorage'` – set `localStorage.setItem('datocms:ve','1')` to enable.
- `'always'` – always on (useful on preview deployments).
- function – custom `(window) => boolean`.

---

## Step 3 (recommended): Auto-clean stega characters

### Why cleanup is needed

- The stega markers are **zero-width Unicode codepoints** embedded in strings.
- They are invisible but can **subtly affect kerning/line breaking** in some fonts.
- Frameworks may strip or re-serialize text nodes during hydration, occasionally removing the markers in **unpredictable ways**.
- Running **AutoClean** performs a **controlled, predictable scrub** shortly after hydration—**your layout matches production** while overlays still work.

### How overlays keep working after cleanup

- `enableDatoVisualEditing({ persistAfterClean: true })` *(default)* caches each decoded payload.
- When AutoClean removes the characters, the library **reuses the cached metadata** to keep overlays clickable.
- **Leave `persistAfterClean` enabled** unless you intentionally want the markers to stay in the DOM.

### Ways to run AutoClean

Pick **one** approach:

1. **React component** (wraps any element subtree)

   ```tsx
   <DatoAutoClean as="article" options={{ delayMs: 32 }}>
     {/* children with stega text/img alts */}
   </DatoAutoClean>
   ```

2. **React hook** (attach to a specific ref)

   ```tsx
   'use client';
   import { useRef } from 'react';
   import { useDatoAutoClean } from 'datocms-visual-editing/react';

   const ref = useRef<HTMLSpanElement>(null);
   useDatoAutoClean(ref, { delayMs: 32, observe: false });
   ```

3. **Attribute-based** (no framework)

   ```html
   <span data-datocms-auto-clean>
     $9.99 <!-- stega-encoded -->
   </span>
   <script type="module">
     import { enableDatoAutoClean } from 'datocms-visual-editing';
     enableDatoAutoClean(); // cleans every [data-datocms-auto-clean]
   </script>
   ```

4. **Programmatic (per container)**

   ```ts
   import { autoCleanStegaWithin } from 'datocms-visual-editing';

   const dispose = autoCleanStegaWithin(containerEl, {
     delayMs: 32,
     observe: false,
     cleanImageAlts: true,
     // skip areas you actively edit
     skipSelectors: ['[contenteditable="true"]']
   });
   ```

**Options**

- `delayMs` *(default 32ms)*: debounce cleanup after mutations.
- `observe` *(default false)*: watch for later text/alt changes (useful with live preview).
- `cleanImageAlts` *(default true)*: also scrub `<img alt>`.
- `skipSelectors`: don’t touch user-editable areas.

---

## Images: how visual editing works for `<img>`

DatoCMS embeds stega metadata in **`<img alt="...">`** strings. That’s how the library can draw a box over the visual image and open the right record/field.

### Checklist for images

- ✅ **Ensure `alt` is present and non-empty.** No `alt`, no metadata.
- ✅ If the `<img>` is **lazy or initially `0×0`**, add `data-datocms-edit-target` to a wrapper; overlays will use the wrapper’s geometry.
- ✅ AutoClean with `cleanImageAlts: true` (default) is safe—the observer caches metadata, so overlays continue to work after alt cleanup.
- ✅ Hovering the **wrapper** works too; the library resolves descendant image matches.

**Example**

```html
<a class="card" data-datocms-edit-target>
  <img src="/hero.jpg" alt="<!-- stega-encoded --> Hero image" />
</a>
```

### When to use explicit tags (backgrounds, svgs, numbers…)

Many things **don’t** carry stega automatically (background images, inline SVGs, numbers, slugs, booleans, JSON, icons). Opt them into visual editing with **explicit attributes**:

```html
<!-- Minimal JSON payload -->
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

<!-- If your query returned _editingUrl, you can skip itemId/itemTypeId -->
<div
  data-datocms-edit-info='{
    "editUrl": "https://acme.admin.datocms.com/editor/items/789/edit#fieldPath=gallery.0.alt",
    "locale": "en"
  }'
  data-datocms-edit-target
>
  <svg aria-hidden="true" className="icon"></svg>
</div>
```

Or generate the attributes in JS/React:

```tsx
import { buildEditTagAttributes } from 'datocms-visual-editing';

const attrs = buildEditTagAttributes({
  itemId: '123',
  itemTypeId: '123456',     // model numeric ID
  fieldPath: 'seo.title',
  locale: 'en'
});

return <span {...attrs} data-datocms-edit-target>Title</span>;
```

> Always include a **`locale`** when using explicit tags so the editor opens the localized field.

---

## Structured Text (DAST): make the whole block clickable

### How stega is injected into Structured Text

For **Structured Text fields**, DatoCMS appends the stega metadata **only once**:

> the metadata is added to the **end of the last `span`** inside the **first** block-level node found (paragraph, heading, list, code, or blockquote).

Implication: by default, only that *specific text node* carries the editing payload. If you rely on that alone, the hover target may feel tiny (e.g., only the tail of the first paragraph highlights).

### Goal: a single overlay for the entire `<StructuredText>` output

Use the **“info + target”** pattern:

- Let the library **discover the info** (from the embedded stega in that first block), **or** provide it explicitly.
- Tell the library **which element’s geometry** to use for the hit area via `data-datocms-edit-target`.

#### Option A — Preferred (no extra data needed)

Wrap your `<StructuredText>` with a container marked as the **target**. The library will decode the stega inside, but draw/merge the overlay using the wrapper’s rectangle.

```tsx
import { StructuredText } from 'react-datocms';
import { DatoAutoClean } from 'datocms-visual-editing/react';

export function ArticleBody({ body }) {
  return (
    <DatoAutoClean as="section" className="prose" options={{ delayMs: 32 }}>
      {/* Use the wrapper geometry for overlays */}
      <div data-datocms-edit-target>
        <StructuredText data={body} />
      </div>
    </DatoAutoClean>
  );
}
```

This gives you a **single, generous hover area** over the entire block while still deep-linking to the correct **record/field** from the inner stega payload.

#### Option B — Bulletproof (works even when the field is empty)

Also stamp **explicit info** on the wrapper so the overlay exists even if the field renders no text (e.g., empty body, or first block is a code/list with edge cases).

```tsx
import { StructuredText } from 'react-datocms';
import { DatoAutoClean } from 'datocms-visual-editing/react';
import { buildEditTagAttributes } from 'datocms-visual-editing';

export function ArticleBody({ itemId, locale, body }) {
  const attrs = buildEditTagAttributes({
    itemId,            // the record ID (string)
    fieldPath: 'body', // the API key path of your Structured Text field
    locale             // important if the field is localized
    // itemTypeId optional; if omitted we use the generic /editor/items/<id> route
  });

  return (
    <DatoAutoClean as="section" options={{ delayMs: 32 }}>
      <div {...attrs} data-datocms-edit-target>
        <StructuredText data={body} />
      </div>
    </DatoAutoClean>
  );
}
```

> **Tip:** Keep `enableDatoVisualEditing({ persistAfterClean: true })` (default). We decode and cache the payload **before** AutoClean strips the invisible characters, so overlays keep working with a clean DOM.

---

### Using `react-datocms` effectively

`react-datocms` is great for both rich text and images, but there are a few details to get right.

#### 1) Structured Text with embedded blocks/links

If your Structured Text contains **block records**, **inline records**, or **links to records**, you can expose generous targets for those too:

```tsx
<StructuredText
  data={body}
  renderBlock={({ record }) => {
    if (record.__typename === 'ImageBlockRecord') {
      // Edit the whole block record (not just the inner <img>)
      return (
        <figure
          {...buildEditTagAttributes({
            itemId: record.id,
            fieldPath: 'image',
            locale
          })}
          data-datocms-edit-target
        >
          <Image data={record.image.responsiveImage} />
          {record.caption && <figcaption>{record.caption}</figcaption>}
        </figure>
      );
    }
    return null;
  }}
  renderInlineRecord={({ record }) => (
    <span
      {...buildEditTagAttributes({
        itemId: record.id,
        fieldPath: 'title',
        locale
      })}
      data-datocms-edit-target
      className="inline-record"
    >
      {record.title}
    </span>
  )}
  renderLinkToRecord={({ record, children }) => (
    <a
      {...buildEditTagAttributes({
        itemId: record.id,
        fieldPath: 'slug',
        locale
      })}
      data-datocms-edit-target
      href={`/posts/${record.slug}`}
    >
      {children}
    </a>
  )}
/>
```

> The overlay system chooses the **most specific** target under the pointer. That means block/inline targets remain independently clickable even if the whole `<StructuredText>` wrapper is also a target.

#### 2) Images rendered via `react-datocms`’s `<Image>`

- Keep the **`alt` returned by DatoCMS** in preview; that’s where the **image stega** lives. If you force `alt=""` in preview, we can’t decode the image’s payload.
- If the image starts **0×0** (lazy, responsive), wrap it and mark the wrapper as the **target**:

  ```tsx
  import { Image } from 'react-datocms';

  <figure data-datocms-edit-target>
    <Image data={record.coverImage.responsiveImage} />
  </figure>
  ```

- AutoClean with `cleanImageAlts: true` is safe—metadata is cached before we scrub.

---

### Common pitfalls & fixes (Structured Text)

- **Only the end of the first block highlights**  
  Add a wrapper with `data-datocms-edit-target` (Option A), or also add explicit info (Option B).

- **The body is empty; no overlay appears**  
  Use **Option B** (explicit info on the wrapper). Example:

  ```tsx
  <section
    {...buildEditTagAttributes({ itemId: post.id, fieldPath: 'body', locale })}
    data-datocms-edit-target
  >
    <StructuredText data={post.body} />
  </section>
  ```

- **First node is a `code`/`list`/`blockquote` and the hit area is tiny or awkward**  
  Same fix: mark the wrapper as the target (and optionally provide explicit info).

- **Click conflicts with real links inside the content**  
  Overlays are active only when editing is enabled (`?edit=1`, `localStorage`, or `always`). If needed, use:

  ```ts
  enableDatoVisualEditing({
    onBeforeOpen(url, ev, info) {
      // return false to keep your app link behavior
    }
  });
  ```

- **You’re rendering “decorative” images inside Structured Text**  
  If you set `alt=""`, the image won’t carry stega. Put **explicit info** on a wrapper around the image block so it still gets an overlay.

- **Live preview updates change the content after mount**  
  Run AutoClean with `observe: true` on the container that hosts `<StructuredText>`:

  ```tsx
  <DatoAutoClean as="section" options={{ delayMs: 32, observe: true }}>
    <div data-datocms-edit-target>
      <StructuredText data={body} />
    </div>
  </DatoAutoClean>
  ```

- **CSS clipping / transforms hide the overlay**  
  The overlay draws in a portal at the document level. If your wrapper has unusual CSS (`overflow: hidden` + heavy transforms), give it some breathing room or put the `data-datocms-edit-target` on a stable ancestor.

---

### FAQ for Structured Text

- **Do I need to fetch anything special for Structured Text?**  
  No extra fields are required beyond your Structured Text field itself. Just ensure your GraphQL requests include the **visual-editing headers** (use `withContentLinkHeaders`).

- **Will AutoClean remove the stega and break overlays?**  
  No. Keep `persistAfterClean: true` (default). We decode and cache before cleaning.

- **What if I can’t easily wrap `<StructuredText>`?**  
  Use `applyEditTagAttributes(el, info)` imperatively after render, or set a `ref` and call `autoCleanStegaWithin(ref.current)` and add `data-datocms-edit-target` to a suitable ancestor.

---

## Verifying your integration

1. **Enable overlays**: add `?edit=1` to your preview URL.
2. **Hover** over text and images: you should see subtle highlight boxes and an optional badge.
3. **Click**: DatoCMS editor opens to the exact record + field.
4. **Debug logging** (optional):

   ```ts
   enableDatoVisualEditing({ baseEditingUrl, activate: 'always', debug: true });
   ```

   Every click logs `{ url, info, element }` to the console for easy inspection.

---

## Tuning overlays (hit area, hover, accessibility)

```ts
enableDatoVisualEditing({
  baseEditingUrl,
  overlays: 'hover',
  showBadge: true,
  badgeLabel: 'Apri in DatoCMS', // i18n for text + aria-label
  targetAttribute: 'data-datocms-edit-target', // or 'data-vercel-edit-target'
  hitPadding: 8,                // forgive near-miss hovers (px or { x,y,top,right,bottom,left })
  minHitSize: { width: 44, height: 32 }, // ensure accessible targets for tiny strings
  hoverLingerMs: 120,           // avoids flicker when skimming edges
  mergeSegments: 'proximity',   // 'proximity' | 'always' | 'never'
  mergeProximity: 6,            // how close lines must be to merge
  openInNewTab: true,           // _blank with noopener,noreferrer
  onBeforeOpen(url, event, info) {
    // return false to cancel navigation for this click
  },
  onResolveUrl(info) {
    // return a custom editor URL string or null to skip overlay
    return null;
  }
});
```

**Accessibility**: overlays use an `aria-live` root, hide decorative segments with `aria-hidden`, and the badge is keyboard-accessible (`Enter`/`Space`). When reusing the current tab, focus is released before navigation to avoid a stuck focus ring.

---

## Deep link behaviour

- If the payload has `editUrl` **on the same origin** as your `baseEditingUrl`, the library reuses it verbatim. If you also provide `locale`, the library **merges** it into the `#fieldPath` hash if missing.
- Otherwise it builds a URL like:

  ```
  https://<base>/[environments/<env>]/editor/item_types/<itemTypeId>/items/<itemId>/edit#fieldPath=<path[.locale]>
  ```

- If `itemTypeId` is missing, it uses the simpler `/editor/items/<itemId>/edit` route.
- Pass `environment` globally or per payload to target non-main environments.

---

## Recipes (GraphQL clients, Next.js, plain JS)

**graphql-request**

```ts
import { GraphQLClient } from 'graphql-request';
import { withContentLinkHeaders } from 'datocms-visual-editing';

const rawFetch = withContentLinkHeaders(fetch, 'https://acme.admin.datocms.com');

const client = new GraphQLClient('https://graphql.datocms.com/', {
  fetch: rawFetch,
  headers: { Authorization: `Bearer ${token}` }
});
```

**Apollo**

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

**Plain JS page (no build tooling)**  
See `examples/plain-js/index.html` in this repo for a minimal script-tag demo.

**Next.js App Router demo**  
See `examples/nextjs-app-router/`.

---

## API reference

**Browser**

- `enableDatoVisualEditing(opts): () => void`  
  Mount overlays; returns a disposer (tear down on SPA route changes).

- `enableDatoAutoClean(selector?, opts?): () => void`  
  Cleans inside every element matching `selector` (defaults to `[data-datocms-auto-clean]`).

- `autoCleanStegaWithin(element, opts): () => void`  
  Programmatic cleaner for a specific container.

- `buildDatoDeepLink(info, baseEditingUrl, environment?): string`  
  Build the editor URL yourself (reused internally).

- `buildEditTagAttributes(info, format?): Record<string,string>`  
  Generate `data-datocms-*` attributes for explicit tagging. `format`: `'json'` *(default)* or `'attrs'`.

- `applyEditTagAttributes(el, info, format?)`  
  Imperatively stamp those attributes on a DOM element.

**React (subpath import `datocms-visual-editing/react`)**

- `useDatoAutoClean(ref, options?)`
- `<DatoAutoClean as="span" options={...}>…</DatoAutoClean>`

**Utility**

- `withContentLinkHeaders(fetch?, defaultBaseEditingUrl?)`  
  Ensures required headers and preserves Request body/duplex.
- `decodeStega(text): DecodedInfo | null`
- `stripStega(text): string`

---

## Troubleshooting

- **No overlays appearing**  
  Missing headers? Use `withContentLinkHeaders` and confirm `X-Base-Editing-Url`. Not activated? Add `?edit=1` or set `activate: 'always'`. Wrong project URL? `baseEditingUrl` must match your DatoCMS project (and environment).

- **Badge/outline misaligned**  
  Wrap the card with `data-datocms-edit-target` so geometry uses the stable container. Consider `minHitSize` for tiny inline strings.

- **Images not showing overlays**  
  `alt` must be non-empty. If the `<img>` is zero-sized, tag the wrapper: `data-datocms-edit-target`. Background images / SVGs / icons: add **explicit tags** (see section above).

- **Structured Text overlay only covers a tiny span**  
  Wrap the output with `data-datocms-edit-target` (and optionally add explicit info) so the whole block is clickable.

- **Navigation blocked or needs customization**  
  Use `onBeforeOpen` to allow/deny per click. Use `onResolveUrl` to redirect certain fields to custom tabs in the editor.

- **Layout shifts or weird wrapping**  
  Add AutoClean. Keep `persistAfterClean: true`.

---

## License

- Project: **MIT** (see `LICENSE`)
- Bundled dependency: `@vercel/stega` — **MPL-2.0** (see `LICENSES.md`)

