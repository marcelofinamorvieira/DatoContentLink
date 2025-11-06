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

## Using Visual Editing with thee Real Time API

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

## Options (most used)

- `baseEditingUrl` (required): DatoCMS project admin URL.
- `environment` (optional): environment slug for deep links.
- `root` (optional): limit scanning/observation to a subtree.
- `debug` (false): add debug attributes for inspection.
- `autoEnable` (true): set false for manual enable/disable.
- `resolveEditUrl(info, ctx)`: rewrite/skip links (return null to skip).

Lifecycle updates fire CustomEvents on `document`:

```ts
document.addEventListener('datocms:visual-editing:ready', (event) => {
  console.log('ready', event.detail); // MarkSummary payload
});
```

Other events: `datocms:visual-editing:marked`, `datocms:visual-editing:state`, `datocms:visual-editing:warn`.

## Troubleshooting

- No overlay: ensure elements have `data-datocms-edit-url` (check your fetch headers).
- Wrong highlight: add `data-datocms-edit-target` to the desired wrapper.
- Multiple payloads on one element: split content into dedicated wrappers.

## Learn more & examples

- Full guide with API details → [README.full.md](./README.full.md)
- Next.js App Router example → [examples/nextjs-app-router](./examples/nextjs-app-router/)
- Plain JS sample → [examples/plain-js](./examples/plain-js/)
- Payload inspection scripts → [examples/payload-inspection](./examples/payload-inspection/)

## License

MIT © DatoCMS
