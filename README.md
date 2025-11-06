# DatoCMS Visual Editing

[![npm version](https://img.shields.io/npm/v/datocms-visual-editing.svg)](https://www.npmjs.com/package/datocms-visual-editing) [![License: MIT](https://img.shields.io/npm/l/datocms-visual-editing.svg)](./LICENSE)

Click-to-edit overlays for DatoCMS projects. Platform and framework agnostic, two function calls to set it up.

![Usage demo](./docs/usage.gif)

```bash
npm install datocms-visual-editing
```

## Quick start

1) Fetch preview content with visual-editing headers

You can set the headers manually with plain `fetch`:

```ts
const response = await fetch('https://graphql.datocms.com/', {
  method: 'POST',
  headers: {
    Authorization: `Bearer ${process.env.DATO_PREVIEW_API_TOKEN}`,
    'X-Visual-Editing': 'vercel-v1', //vercel-v1 is just the identifier: You do not neeed to be hosting on Vercel.
    'X-Base-Editing-Url': 'https://acme.admin.datocms.com'
  },
  body: JSON.stringify({ query })
});
```

Or use the helper to attach the headers automatically (recommended):

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

2) Enable overlays on your preview page

```ts
import { enableDatoVisualEditing } from 'datocms-visual-editing';

const controller = enableDatoVisualEditing({
  baseEditingUrl: 'https://acme.admin.datocms.com',
  environment: 'main'
});
```

Optional toggle (React):

```tsx
'use client';
import { useEffect, useRef } from 'react';
import { enableDatoVisualEditing, type VisualEditingController } from 'datocms-visual-editing';

export function VisualEditingToggleButton() {
  const controllerRef = useRef<VisualEditingController | null>(null);

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

### Cleanup & disposal

- The runtime scrubs zero‑width stega markers automatically after stamping attributes on elements.
- Call `controller.dispose()` when your preview surface unmounts (e.g. SPA route change). This disconnects observers and removes only the generated attributes the library added.
- Need cleanup without enabling overlays? Use `enableDatoAutoClean(selector, options)` to scrub stega payloads in a specific DOM subtree.

## Using Visual Editing with the Real Time API

Use this only if your preview receives real-time updates via DatoCMS [Real‑time Updates API](https://www.datocms.com/docs/real-time-updates-api). If you render a static snapshot from the [Content Delivery API](https://www.datocms.com/docs/content-delivery-api), you can skip this hook; `enableDatoVisualEditing` alone will show overlays on first render, but there will be no live re-scan.

```tsx
'use client';
import { useRef } from 'react';
import { useDatoVisualEditingListen } from 'datocms-visual-editing/react';

function subscribe({ onUpdate }: { onUpdate: () => void }) {
  const sse = new EventSource('/api/dato/listen');
  sse.onmessage = () => onUpdate();
  return () => sse.close();
}

export function PreviewVisualEditing() {
  const scopeRef = useRef<HTMLDivElement | null>(null);
  useDatoVisualEditingListen(subscribe, {
    controllerOptions: { baseEditingUrl: 'https://acme.admin.datocms.com', environment: 'main' },
    scopeRef,
    initialRefresh: true
  });
  return <div ref={scopeRef} />;
}
```

## API & attributes: prototypes and their functions

### enableDatoVisualEditing(options): VisualEditingController

```ts
type EnableDatoVisualEditingOptions = {
  baseEditingUrl: string;   // required
  environment?: string;     // optional environment slug for deep links
  root?: ParentNode;        // limit scanning/observation to a subtree (default: document)
  debug?: boolean;          // expose debug attributes for inspection (default: false)
  autoEnable?: boolean;     // manually enable/disable when false (default: true)
  resolveEditUrl?: (info: DecodedInfo, ctx: { baseEditingUrl: string; environment?: string }) => string | null;
};

type VisualEditingController = {
  enable(): void;
  disable(): void;
  toggle(): void;
  dispose(): void;
  isEnabled(): boolean;
  isDisposed(): boolean;
  refresh(root?: ParentNode): void;
};
```

Returns a controller to manage overlays and rescans.

### withContentLinkHeaders(fetchLike, baseEditingUrl)

```ts
function withContentLinkHeaders(
  fetchImpl?: typeof fetch,
  baseEditingUrl: string
): (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;
```

Wraps `fetch` to send `X-Visual-Editing: vercel-v1` and `X-Base-Editing-Url: <normalized>` on every request.

### enableDatoAutoClean(selector?, options?): () => void

```ts
type AutoCleanOptions = {
  delayMs?: number;
  observe?: boolean;
  cleanImageAlts?: boolean;
  observeImageAlts?: boolean;
  skipSelectors?: string[];
};

function enableDatoAutoClean(
  selector?: string,
  options?: Omit<AutoCleanOptions, 'observe'>
): () => void;
```

Scrubs stega payloads from a DOM subtree without enabling overlays. Returns a disposer to stop observers/timers.

### Attributes contract

- `data-datocms-edit-url`: exact DatoCMS editor deep link used by overlays.
- `data-datocms-editable`: convenience flag stamped on every editable target.
- `data-datocms-generated="stega"`: guard to clean only attributes created by the runtime.
- `data-datocms-edit-target`: move attributes to a specific wrapper element.
- Debug (when `debug: true`): `data-datocms-debug`, `data-datocms-debug-reason`, `data-datocms-debug-url`, `data-datocms-debug-info`.

### Manual attribute helpers

```ts
type EditTagInfo = {
  itemId?: string;
  itemTypeId?: string;
  fieldPath?: string | Array<string | number>;
  environment?: string;
  locale?: string;
  editUrl?: string;
  _editingUrl?: string;
};
type EditTagFormat = 'url' | 'json' | 'attrs';

function buildEditTagAttributes(info: EditTagInfo, format?: EditTagFormat): Record<string, string>;
function getDatoEditInfo(element: Element): DecodedInfo | null;
```

Use `buildEditTagAttributes` to generate attributes server‑side; `getDatoEditInfo` reads metadata from an element (prefers explicit attributes, falls back to stega).

### Low‑level utilities

```ts
function decodeStega(input: string): DecodedInfo | null;
function stripStega(input: string): string;

type StegaState = {
  scope: ParentNode;
  editableTotal: number;
  generatedTotal: number;
  explicitTotal: number;
  infoOnlyTotal: number;
  encodedTextNodes: number;
  encodedImageAlts: number;
  samples: { editable?: string[]; infoOnly?: string[] };
};
function checkStegaState(root?: ParentNode): StegaState;
```

### React helper

```ts
import { useDatoVisualEditingListen, type UseDatoVisualEditingListenOptions, type ListenSubscribe } from 'datocms-visual-editing/react';

type ListenSubscribe = (handlers: { onUpdate: () => void; onError?: (err: unknown) => void }) => () => void;
type UseDatoVisualEditingListenOptions = {
  controller?: VisualEditingController;
  controllerOptions?: EnableDatoVisualEditingOptions;
  scopeRef?: React.RefObject<ParentNode | null>;
  initialRefresh?: boolean;
  onError?: (err: unknown) => void;
};
```

## Advanced usage

### Manually marking elements

- You can author edit attributes yourself. The overlay activates on the nearest element with `data-datocms-edit-url` and `data-datocms-editable`.
- Prefer generating attributes from decoded payloads using server helpers or provide a custom `resolveEditUrl` when enabling the runtime.
- If multiple payloads would map to the same element, split content into dedicated wrappers.

Target wrappers explicitly with `data-datocms-edit-target` so a parent wrapper receives the attributes instead of the inner element. For images with zero size, the nearest wrapper is automatically targeted so the overlay stays clickable.

### Working with custom roots

Pass a `root` to scope scanning and observation to a particular subtree (for example, a ShadowRoot or a specific container). Only nodes within that root are touched and later cleaned by `dispose()`.

## Runtime & debugging

### Runtime behaviour

1. Initial scan – walks text nodes and `<img alt>` values inside `root`, decodes stega, stamps attributes, scrubs markers.
2. MutationObserver – watches character data, child list changes, and `alt` mutations; rescans are batched via microtasks.
3. Overlay controller – listens for hover/click/focus/keyboard; opens the nearest ancestor’s `data-datocms-edit-url` in a new tab.
4. Dispose – disconnects observers, tears down listeners, removes only generated attributes.

### Lifecycle events

Listen to DOM CustomEvents on `document`:

```ts
document.addEventListener('datocms:visual-editing:ready', (event) => {
  console.log('ready', (event as CustomEvent).detail);
});
```

Event names: `datocms:visual-editing:ready`, `datocms:visual-editing:marked`, `datocms:visual-editing:state`, `datocms:visual-editing:warn`.

- `ready` / `marked`: MarkSummary payload
- `state`: `{ enabled, disposed }`
- `warn`: `{ code, message }` (development only)

### Streaming & rehydration

- When streaming preview responses or rehydrating, reuse the server-rendered DOM nodes. The `_editingUrl` metadata lives on those elements; replacing them breaks overlays.
- Mutate text/attributes in place and call `controller.refresh(root?)` after new markup lands, or use `useDatoVisualEditingListen`.

### Debug tools and low‑level helpers

- `debug: true` adds `data-datocms-debug-*` attributes for in-browser inspection.
- `checkStegaState(root?)` provides programmatic insight into editable totals and leftover markers.
- Utilities: `decodeStega(string)`, `stripStega(string)`, `getDatoEditInfo(element)`, `buildEditTagAttributes(info, format)`.
## Troubleshooting

- No overlay: ensure elements have `data-datocms-edit-url` (check your fetch headers).
- Wrong highlight: add `data-datocms-edit-target` to the desired wrapper.
- Multiple payloads on one element: split content into dedicated wrappers.

## Examples & demos

- Next.js App Router example → [examples/nextjs-app-router](./examples/nextjs-app-router/)
- Plain JS sample → [examples/plain-js](./examples/plain-js/)
- Payload inspection scripts → [examples/payload-inspection](./examples/payload-inspection/)
 - Ecommerce Website Demo (Visual Editing + Realtime Updates) → [imagesVisualEditing branch](https://github.com/datocms/ecommerce-website-demo/tree/imagesVisualEditing)

## Contributing & development

- Install: `pnpm install` (Node ≥18)
- Build: `pnpm run build`
- Test: `pnpm run test` (or `pnpm run test:watch`)
- Lint/format: `pnpm run lint` / `pnpm run format`
- See `CONTRIBUTING.md` for detailed guidelines and integration testing setup.

## License

MIT © DatoCMS
