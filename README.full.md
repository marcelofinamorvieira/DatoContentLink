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

   const fetchDato = withContentLinkHeaders(
     fetch,
     'https://acme.admin.datocms.com'
   );

   const response = await fetchDato('https://graphql.datocms.com/', {
     method: 'POST',
     headers: {
       Authorization: `Bearer ${process.env.DATO_PREVIEW_API_TOKEN}`
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

  // Call `visualEditing.dispose()` if you unmount the page (SPA route change, etc.).
   ```

Optional toggle (React):

```tsx
'use client';
import { useEffect, useRef } from 'react';
import { enableDatoVisualEditing } from 'datocms-visual-editing';

export function VisualEditingToggleButton() {
  const controllerRef = useRef<ReturnType<typeof enableDatoVisualEditing> | null>(null);

  useEffect(() => {
    controllerRef.current = enableDatoVisualEditing({
      baseEditingUrl: 'https://acme.admin.datocms.com',
      environment: 'main'
    });
    return () => controllerRef.current?.dispose();
  }, []);

  return (
    <button type="button" onClick={() => controllerRef.current?.toggle()}>
      Toggle visual editing
    </button>
  );
}
```

That’s it. On activation we scan the DOM, decode stega payloads, stamp attributes, scrub markers,
and start a single `MutationObserver` to keep new nodes in sync. Overlays are live immediately.

> Need custom overlay links? Pass a `resolveEditUrl` function when calling `enableDatoVisualEditing`. It receives the decoded stega payload and can return any URL (or `null` to skip stamping individual nodes).

---

### Streaming & rehydration

When streaming preview responses (React Server Components, Remix responses, or SSE “Listen” updates), reuse the exact DOM nodes that shipped from the server. The `_editingUrl` metadata travels on those elements; replacing them breaks overlays. Mutate text/attributes in place and call `controller.refresh(root?)` after the new markup lands (or use the `useDatoVisualEditingListen` hook below). The controller batches rescans, fires lifecycle events, and—in development—warns once if the initial enable detects zero editables (a common signal that the DOM was replaced). See working examples: [examples/nextjs-app-router](./examples/nextjs-app-router/), [examples/plain-js](./examples/plain-js/), and [examples/payload-inspection](./examples/payload-inspection/).

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

## API Reference

### `enableDatoVisualEditing(options): VisualEditingController`

```ts
type EnableDatoVisualEditingOptions = {
  baseEditingUrl: string;   // required
  environment?: string;     // optional environment slug for diagnostics + deep links
  root?: ParentNode;        // restrict scanning/observation to a subtree (default: document)
  debug?: boolean;          // expose debug attributes for in-browser inspection (default: false)
  autoEnable?: boolean;     // set to false when you want manual enable/disable control (default: true)
  resolveEditUrl?: (info: DecodedInfo, ctx: { baseEditingUrl: string; environment?: string }) => string | null;
};
```

Returns a controller with the following methods:

- `enable()` / `disable()` / `toggle()` – control overlays on demand.
- `isEnabled()` / `isDisposed()` – expose state for UI bindings.
- `dispose()` – permanently tear everything down and scrub generated attributes.
- `refresh(root?)` – queue a stega rescan for the whole root or a specific subtree (handy after streaming updates).

> **SPA note:** call `dispose()` on route changes if you mount/unmount the preview surface manually. After disposal the controller becomes inert.

Provide a `resolveEditUrl` callback when you want to rewrite or filter linking behaviour on a per-node basis (for example, to send certain payloads to custom dashboards). Return `null` from the callback to skip stamping a given element entirely.

Lifecycle updates are dispatched as DOM `CustomEvent`s on `document`. Each event carries a `MarkSummary` payload (`editableTotal`, `generatedStamped`, `generatedUpdated`, `explicitTotal`, and the processed `scope`). Listen with:

```ts
document.addEventListener('datocms:visual-editing:ready', (event) => {
  console.log('ready', event.detail);
});
```

Event names: `datocms:visual-editing:ready`, `datocms:visual-editing:marked`, `datocms:visual-editing:state`, and `datocms:visual-editing:warn`. Warnings fire only in development (for example when `enable()` finds zero editables).

### Debug inspection toggle

Pass `debug: true` to stamp additional diagnostics on every editable element and any explicit `data-datocms-edit-url` you authored yourself. The library adds:

- `data-datocms-debug="on"`
- `data-datocms-debug-reason` (`"stega"` when derived from steganographic payloads, `"explicit"` for attributes you authored)
- `data-datocms-debug-url` (the resolved deep link)
- `data-datocms-debug-info` (JSON payload with the decoded metadata)

These attributes make it easy to inspect the resolved editing info directly in DevTools. They are removed automatically when you call `dispose()` on the controller returned by `enableDatoVisualEditing`.

### State inspectors

- Use `checkStegaState(root?)` to get programmatic insight into editable totals, generated vs. explicit counts, info-only attributes, and leftover encoded markers.
- Need to audit raw payloads? Check [examples/payload-inspection](./examples/payload-inspection/) for ready-to-run Node scripts that log the decoded stega metadata for uploads and hero sections.

### `withContentLinkHeaders(fetchLike, baseEditingUrl)`

Wraps `fetch` (or a compatible function) so every request sends the headers required by DatoCMS to embed visual editing metadata. The `baseEditingUrl` is mandatory and will be applied to all requests.

### `enableDatoAutoClean(selector, options)`

Run the same cleanup that powers the runtime on any DOM subtree. Pass a CSS selector (or `HTMLElement`) to keep those nodes clear of stega payloads without enabling overlays. Options let you disable image cleanup (`cleanImageAlts: false`) or observation (`observeImageAlts: false`) when you want one-off scrubbing.

### React helpers

- `useDatoVisualEditingListen(subscribe, options)` – keeps overlays in sync with Dato “Listen” subscriptions (streaming / SSE preview updates).

Note: Use this hook when your preview consumes DatoCMS [Real‑time Updates API](https://www.datocms.com/docs/real-time-updates-api) (Listen/SSE). If you only fetch one‑off snapshots from the [Content Delivery API](https://www.datocms.com/docs/content-delivery-api), skip the hook; `enableDatoVisualEditing` is sufficient, and you can manually call `controller.refresh(root?)` after your UI updates.

React example (Listen/stream updates):

```tsx
'use client';

import { useRef } from 'react';
import { useDatoVisualEditingListen } from 'datocms-visual-editing/react';

// Minimal subscription using an SSE endpoint that emits when preview data changes.
// Replace with your Dato Listen client or framework adapter.
function subscribe({ onUpdate, onError }: { onUpdate: () => void; onError?: (e: unknown) => void }) {
  const sse = new EventSource('/api/dato/listen');
  sse.onmessage = () => onUpdate();
  sse.onerror = (e) => onError?.(e);
  return () => sse.close();
}

export function PreviewVisualEditing() {
  const scopeRef = useRef<HTMLDivElement | null>(null);

  useDatoVisualEditingListen(subscribe, {
    controllerOptions: {
      baseEditingUrl: 'https://acme.admin.datocms.com',
      environment: 'main'
    },
    scopeRef, // optional: limit rescans to this subtree
    initialRefresh: true
  });

  return <div ref={scopeRef} />;
}
```

Also see the Next.js App Router example: [examples/nextjs-app-router](./examples/nextjs-app-router/).

### Low-level utilities

- `decodeStega(string)` / `stripStega(string)` – stega helpers re-exported for convenience.
- `buildEditTagAttributes(info, format)` – build explicit attributes if you want to hand-stamp elements server-side. Defaults to the URL-only format; pass `'json'` or `'attrs'` to include metadata payloads.
- `getDatoEditInfo(element)` – read explicit attributes or JSON payloads from markup you crafted yourself.

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

## Development

- `pnpm run lint` – static analysis across `src/` and `tests/`.
- `pnpm run test` – full Vitest suite with coverage (`coverage/`).
- `pnpm run test:watch` – hot Vitest runner for feature work.
- `pnpm run format` / `pnpm run format:check` – Prettier helpers.

See `CONTRIBUTING.md` for the full contribution guide.

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


