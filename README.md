# DatoCMS Visual Editing

Click-to-edit overlays for content rendered from DatoCMS – without the Vercel toolbar.  
This library decodes the steganographic payload that ships with DatoCMS preview responses,
stamps DOM attributes on the real elements in your page, and wires up pointer/keyboard
interactions that deep-link straight to the right record + field inside the editor.

- **DOM is the source of truth.** There is no in-memory cache, no persisted map. Attributes carry all metadata.
- **Zero-width markers are scrubbed.** As soon as we stamp the attributes, the invisible characters disappear.
- **Overlays resolve from attributes only.** Pointer/focus events look up the nearest `data-datocms-edit-url` – nothing else.

```bash
npm install datocms-visual-editing
```

---

## Quick start

1. **Fetch preview content with visual editing headers.**

   ```ts
   import { withContentLinkHeaders } from 'datocms-visual-editing';

   const fetchDato = withContentLinkHeaders(fetch);

   const response = await fetchDato('https://graphql.datocms.com/', {
     method: 'POST',
     headers: {
       Authorization: `Bearer ${process.env.DATO_PREVIEW_API_TOKEN}`,
       'X-Base-Editing-Url': 'https://acme.admin.datocms.com'
     },
     body: JSON.stringify({ query })
   });
   ```

2. **Call `enableDatoVisualEditing` once your preview page renders.**

   ```ts
   import { enableDatoVisualEditing } from 'datocms-visual-editing';

   const dispose = enableDatoVisualEditing({
     baseEditingUrl: 'https://acme.admin.datocms.com',
     environment: 'main'      // optional – attaches to every stamped element
   });

   // Call `dispose()` if you unmount the page (SPA route change, etc.).
   ```

That’s it. On activation we scan the DOM, decode stega payloads, stamp attributes, scrub markers,
and start a single `MutationObserver` to keep new nodes in sync. Overlays are live immediately.

---

## Attribute contract

Every editable target receives the following attributes (if the data exists):

| Attribute | Purpose |
| --- | --- |
| `data-datocms-edit-url` | Fully-qualified deep link to the record and field in the DatoCMS editor. |
| `data-datocms-item-id` | Record ID (diagnostics) |
| `data-datocms-item-type-id` | Model API key/ID (diagnostics) |
| `data-datocms-environment` | Environment slug when provided |
| `data-datocms-locale` | Locale code extracted from stega payload |
| `data-datocms-generated="stega"` | Guard flag – we only remove the attributes that we stamped |

You can still author attributes manually (for example in static markup). We never overwrite developer-authored
values because they lack the guard flag. During dispose we only clean elements that carry
`data-datocms-generated="stega"`.

### Layout helpers

Add `data-datocms-edit-target` to any wrapper that should receive the attributes instead of the inner element.
We honour it automatically for both text nodes and images. Zero-sized `<img>` elements are upgraded to their
nearest wrapper so the overlay remains clickable.

---

## Runtime behaviour

1. **Initial scan** – walks text nodes + `<img alt>` values inside the provided `root` (defaults to `document`),
   decodes the stega payload, stamps attributes on the nearest element, and replaces the text/alt with the clean
   payload.
2. **MutationObserver** – watches character data, child list changes, and `alt` mutations to rerun the scan when
   new content appears. Work is batched via `queueMicrotask` so bursts of mutations coalesce.
3. **Overlay controller** – listens for pointer hover, clicks, focus, and keyboard activation. The nearest ancestor
   with `data-datocms-edit-url` wins. We compute the highlight box directly from the DOM and open deep links in a new tab
   (`window.open(url, '_blank', 'noopener,noreferrer')`).
4. **Dispose** – disconnects the observer, tears down listeners, and removes only the generated attributes.

---

## API Reference

### `enableDatoVisualEditing(options): () => void`

```ts
type EnableDatoVisualEditingOptions = {
  baseEditingUrl: string;   // required
  environment?: string;     // optional environment slug for diagnostics + deep links
  root?: ParentNode;        // restrict scanning/observation to a subtree (default: document)
  debug?: boolean;          // expose debug attributes for in-browser inspection (default: false)
};
```

Returns a disposer that removes overlays, observers, and generated attributes.

> **SPA note:** call the disposer on route changes if you mount/unmount the preview surface manually.

### Debug inspection toggle

Pass `debug: true` to stamp additional diagnostics on every editable element and any explicit `data-datocms-edit-url` you authored yourself. The library adds:

- `data-datocms-debug="on"`
- `data-datocms-debug-reason` (`"stega"` when derived from steganographic payloads, `"explicit"` for attributes you authored)
- `data-datocms-debug-url` (the resolved deep link)
- `data-datocms-debug-info` (JSON payload with the decoded metadata)

These attributes make it easy to inspect the resolved editing info directly in DevTools. They are removed automatically when you call the disposer returned by `enableDatoVisualEditing`.

### `withContentLinkHeaders(fetchLike)`

Wraps `fetch` (or a compatible function) so every request sends the headers required by DatoCMS to embed visual editing metadata.

### `autoCleanStegaWithin(root, options)` / `enableDatoAutoClean(selector, options)`

Utility helpers to scrub stega markers from a subtree on demand. They complement the automatic cleanup performed by
`enableDatoVisualEditing` and remain useful if you want to clean additional regions outside the visual editing scope.

### React helpers

- `useDatoAutoClean(ref, options)` – React hook that runs `autoCleanStegaWithin`.
- `DatoAutoClean` – minimal component that stamps `data-datocms-auto-clean` and wires the hook for you.

### Low-level utilities

- `decodeStega(string)` / `stripStega(string)` – stega helpers re-exported for convenience.
- `buildEditTagAttributes(info, format)` – build explicit attributes if you want to hand-stamp elements server-side.
- `getDatoEditInfo(element)` – read explicit attributes or JSON payloads from markup you crafted yourself.

All attribute names are exported from `datocms-visual-editing/constants` as `ATTR_*` constants.

---

## Working with custom roots

Pass `root` to scope scanning and observation to a particular subtree (for example, a ShadowRoot or a specific CMS slot):

```ts
const shadowRoot = document.querySelector('#preview-host')?.shadowRoot;
if (shadowRoot) {
  const dispose = enableDatoVisualEditing({
    baseEditingUrl: 'https://acme.admin.datocms.com',
    root: shadowRoot
  });
}
```

We only touch nodes inside that root, and dispose removes attributes within the same boundary.

---

## AutoClean collaboration

`enableDatoVisualEditing` already scrubs zero-width markers after stamping attributes. If you are also using the
stand-alone AutoClean helpers (for example, to clean rich text rendered outside the visual editing surface), the
two approaches coexist happily: attributes always come from the DOM, so there is no cache to fall out of sync.

---

## Troubleshooting

- **No overlay shows up:** confirm the rendered element has `data-datocms-edit-url`. If not, inspect the raw text/alt –
  you may be missing visual editing headers in your fetch.
- **Wrong element is highlighted:** add `data-datocms-edit-target` to the wrapper you want to enlarge.
- **Console warning about multiple stega payloads:** the library warns when two encoded strings resolve to the same DOM element. Split the content into dedicated wrappers (e.g. each with `data-datocms-edit-target`) so every edit URL has its own target.
- **Links open in the same tab:** browser pop-up rules can block `window.open`. Allow pop-ups for your preview domain or
  change the behaviour by wrapping `enableDatoVisualEditing` and calling `window.location.assign` yourself.

---

## License

MIT © DatoCMS
