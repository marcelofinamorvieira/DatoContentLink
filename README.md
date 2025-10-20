# DatoCMS Visual Editing

Click-to-edit overlays for content rendered from DatoCMS – without the Vercel toolbar.  
This library decodes the steganographic payload that ships with DatoCMS preview responses,
stamps DOM attributes on the real elements in your page, and wires up pointer/keyboard
interactions that deep-link straight to the right record + field inside the editor.

- **DOM is the source of truth.** There is no in-memory cache, no persisted map. Attributes carry all metadata.
- **Zero-width markers are scrubbed.** As soon as we stamp the attributes, the invisible characters disappear.
- **Edit URLs come straight from stega.** Pointer/focus events look up the nearest `data-datocms-edit-url` and open it as-is – no hidden rewriting.

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

2. **Instantiate `enableDatoVisualEditing` once your preview page renders.**

   ```ts
   import { enableDatoVisualEditing } from 'datocms-visual-editing';

   const visualEditing = enableDatoVisualEditing({
     baseEditingUrl: 'https://acme.admin.datocms.com',
     environment: 'main'      // optional – available to custom resolveEditUrl handlers
   });

   // Optional toggle button:
   document
     .getElementById('toggle-visual-editing')
     ?.addEventListener('click', () => visualEditing.toggle());

   // Call `visualEditing.dispose()` if you unmount the page (SPA route change, etc.).
   ```

That’s it. On activation we scan the DOM, decode stega payloads, stamp attributes, scrub markers,
and start a single `MutationObserver` to keep new nodes in sync. Overlays are live immediately.

> Need custom overlay links? Pass a `resolveEditUrl` function when calling `enableDatoVisualEditing`. It receives the decoded stega payload and can return any URL (or `null` to skip stamping individual nodes).

---

### Streaming & rehydration

When streaming preview responses (React Server Components, Remix responses, or SSE “Listen” updates), reuse the exact DOM nodes that shipped from the server. The `_editingUrl` metadata travels on those elements; replacing them breaks overlays. Mutate text/attributes in place and call `controller.refresh(root?)` after the new markup lands (or use the `useDatoVisualEditingListen` hook below). The controller batches rescans, fires lifecycle events, and—in development—warns once if the initial enable detects zero editables (a common signal that the DOM was replaced). Copy-pasteable setups live under `examples/nextjs-listen-app-router`, `examples/nextjs-listen-pages-router`, and `examples/remix-listen`.

---

## Attribute contract

By default the runtime keeps things simple:

| Attribute | Purpose |
| --- | --- |
| `data-datocms-edit-url` | The exact edit URL decoded from stega (or supplied by your `resolveEditUrl` hook). |
| `data-datocms-editable` | Convenience flag stamped on every editable target (explicit or generated). |
| `data-datocms-generated="stega"` | Guard flag – we only remove the attributes that we stamped. |

Additional metadata (item ID, model, locale, environment, full decoded payload) is still available, but now opt-in:

- Set `debug: true` when enabling the runtime to add the usual `data-datocms-debug-*` attributes for inspection.
- Use `buildEditTagAttributes(info, 'json' | 'attrs')` if you want to stamp richer attributes manually on the server.
- Call `getDatoEditInfo(element)` or `decodeStega(string)` to retrieve the full `DecodedInfo` structure programmatically.

You can still author attributes manually (for example in static markup). We never overwrite developer-authored values because they lack the guard flag. During dispose we only clean elements that carry `data-datocms-generated="stega"`.

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

### Managing image alt metadata

DatoCMS appends the same steganographic payload to the `alt` value of every referenced upload ([docs](https://www.datocms.com/docs/content-link/how-to-use-content-link)). When the library runs it strips those zero-width markers automatically, but render pipelines that bypass the DOM (Next.js `Image`, RSS feeds, image CDNs, etc.) may need to clean the string themselves. Use the new helpers to cover those scenarios:

- `stripDatoImageAlt(alt)` – remove markers while keeping the visible label intact.
- `decodeDatoImageAlt(alt)` – produce the same `DecodedInfo` payload used by the overlay.
- `withDatoImageAlt(alt)` – get `{ cleanedAlt, editInfo }` in one call so you can forward both values to components or analytics.

If you already rely on `enableDatoAutoClean` or `useDatoAutoClean`, pass `{ cleanImageAlts: false, observeImageAlts: false }` to disable DOM-level scrubbing and delegate the work to these helpers instead.

---

## API Reference

### `enableDatoVisualEditing(options): VisualEditingController`

```ts
type EnableDatoVisualEditingOptions = {
  baseEditingUrl: string;   // required
  environment?: string;     // optional environment slug for diagnostics + deep links
  root?: ParentNode;        // restrict scanning/observation to a subtree (default: document)
  debug?: boolean;          // expose debug attributes for in-browser inspection (default: false)
  autoEnable?: boolean;     // set to false when you want manual enable/disable control (default: true)
  devPanel?: boolean | {    // show a floating dev counter panel in dev builds
    position?: 'br' | 'bl' | 'tr' | 'tl';
  };
  resolveEditUrl?: (info: DecodedInfo, ctx: { baseEditingUrl: string; environment?: string }) => string | null;
  onReady?: (summary: MarkSummary) => void;
  onMarked?: (summary: MarkSummary) => void;
  onStateChange?: (state: { enabled: boolean; disposed: boolean }) => void;
  onWarning?: (warning: { code: string; message: string }) => void;
};
```

Returns a controller with the following methods:

- `enable()` / `disable()` / `toggle()` – control overlays on demand.
- `isEnabled()` / `isDisposed()` – expose state for UI bindings.
- `dispose()` – permanently tear everything down and scrub generated attributes.
- `refresh(root?)` – queue a stega rescan for the whole root or a specific subtree (handy after streaming updates).

> **SPA note:** call `dispose()` on route changes if you mount/unmount the preview surface manually. After disposal the controller becomes inert.

Provide a `resolveEditUrl` callback when you want to rewrite or filter linking behaviour on a per-node basis (for example, to send certain payloads to custom dashboards). Return `null` from the callback to skip stamping a given element entirely.

Lifecycle callbacks receive a `MarkSummary` object (`editableTotal`, `generatedStamped`, `generatedUpdated`, `explicitTotal`, and the processed `scope`). The same payload is dispatched as DOM `CustomEvent`s:

- `datocms:visual-editing:ready` (exported as `EVENT_READY`)
- `datocms:visual-editing:marked` (exported as `EVENT_MARKED`)
- `datocms:visual-editing:state` (exported as `EVENT_STATE`)
- `datocms:visual-editing:warn` (exported as `EVENT_WARN`)

Warnings fire only in development (for example when enable() finds zero editables) and surface through both the `onWarning` callback and the DOM event.

### Debug inspection toggle

Pass `debug: true` to stamp additional diagnostics on every editable element and any explicit `data-datocms-edit-url` you authored yourself. The library adds:

- `data-datocms-debug="on"`
- `data-datocms-debug-reason` (`"stega"` when derived from steganographic payloads, `"explicit"` for attributes you authored)
- `data-datocms-debug-url` (the resolved deep link)
- `data-datocms-debug-info` (JSON payload with the decoded metadata)

These attributes make it easy to inspect the resolved editing info directly in DevTools. They are removed automatically when you call `dispose()` on the controller returned by `enableDatoVisualEditing`.

### Dev panel & state inspectors

- Set `devPanel: true` (or `{ position: 'tr' | 'tl' | 'br' | 'bl' }`) to spawn a lightweight overlay with live counters while developing.
- Use `checkStegaState(root?)` to get programmatic insight into editable totals, generated vs. explicit counts, info-only attributes, and leftover encoded markers.
- Drop the `DatoVisualEditingDevPanel` React component anywhere inside your preview shell to render the same diagnostics using JSX.
- Need to audit raw payloads? Check `examples/payload-inspection/` for ready-to-run Node scripts that log the decoded stega metadata for uploads and hero sections.

### `withContentLinkHeaders(fetchLike)`

Wraps `fetch` (or a compatible function) so every request sends the headers required by DatoCMS to embed visual editing metadata.

### `autoCleanStegaWithin(root, options)` / `enableDatoAutoClean(selector, options)`

Utility helpers to scrub stega markers from a subtree on demand. They complement the automatic cleanup performed by
`enableDatoVisualEditing` and remain useful if you want to clean additional regions outside the visual editing scope.
Set `cleanImageAlts: false` to leave `<img alt>` values untouched and `observeImageAlts: false` to stop watching for `alt`
mutations when you intend to handle them yourself.

### React helpers

- `useDatoAutoClean(ref, options)` – React hook that runs `autoCleanStegaWithin`.
- `DatoAutoClean` – minimal component that stamps `data-datocms-auto-clean` and wires the hook for you.
- `useDatoVisualEditingListen(subscribe, options)` – keeps overlays in sync with Dato “Listen” subscriptions (streaming / SSE preview updates).
- `DatoVisualEditingDevPanel` – React counterpart of the dev panel for JSX-based preview shells.

### Low-level utilities

- `decodeStega(string)` / `stripStega(string)` – stega helpers re-exported for convenience.
- `stripDatoImageAlt(alt)` / `decodeDatoImageAlt(alt)` / `withDatoImageAlt(alt)` – image-specific helpers for render pipelines that do not pass through the DOM auto-cleaner.
- `buildEditTagAttributes(info, format)` – build explicit attributes if you want to hand-stamp elements server-side. Defaults to the URL-only format; pass `'json'` or `'attrs'` to include metadata payloads.
- `getDatoEditInfo(element)` – read explicit attributes or JSON payloads from markup you crafted yourself.

All attribute names are exported from `datocms-visual-editing/constants` as `ATTR_*` constants.

---

## Working with custom roots

Pass `root` to scope scanning and observation to a particular subtree (for example, a ShadowRoot or a specific CMS slot):

```ts
const shadowRoot = document.querySelector('#preview-host')?.shadowRoot;
if (shadowRoot) {
  const visualEditing = enableDatoVisualEditing({
    baseEditingUrl: 'https://acme.admin.datocms.com',
    root: shadowRoot,
    autoEnable: false
  });

  visualEditing.enable();
}
```

We only touch nodes inside that root, and calling `dispose()` removes attributes within the same boundary.

---

## Integration testing

The Vitest integration suite (`tests/dato.integration.test.ts`) talks to a live DatoCMS project.
Create a `.env.visual-editing` file (use `.env.example` as a template) and provide:

- `DATOCMS_VISUAL_EDITING_TOKEN` – Preview Content API token.
- `DATOCMS_VISUAL_EDITING_BASE_URL` – project admin URL, e.g. `https://yourproject.admin.datocms.com`.
- Optional: `DATOCMS_VISUAL_EDITING_GRAPHQL_URL` when using a custom preview endpoint.

Vitest automatically loads `.env.visual-editing`, `.env.test`, `.env.local`, and `.env` before running, so once the file exists you can run `pnpm run test` without exporting variables manually.

The `test/inspectStega.mjs` helper reuses the same variables, so no extra setup is required.

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
