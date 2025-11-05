# DatoCMS Visual Editing

[![npm version](https://img.shields.io/npm/v/datocms-visual-editing.svg)](https://www.npmjs.com/package/datocms-visual-editing) [![License: MIT](https://img.shields.io/npm/l/datocms-visual-editing.svg)](./LICENSE)

Click-to-edit overlays for DatoCMS preview content — no Vercel toolbar.

![Usage demo](./docs/usage.gif)

```bash
npm install datocms-visual-editing
```

## Quick start

1) Fetch preview content with visual-editing headers

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

2) Enable overlays on your preview page

```ts
import { enableDatoVisualEditing } from 'datocms-visual-editing';

const controller = enableDatoVisualEditing({
  baseEditingUrl: 'https://acme.admin.datocms.com',
  environment: 'main'
});

// Optional toggle
document.getElementById('toggle-visual-editing')?.addEventListener('click', () => controller.toggle());
```

## React (streaming / Listen)

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
- `devPanel` (false | { position }): floating dev counters in dev.
- `resolveEditUrl(info, ctx)`: rewrite/skip links (return null to skip).
- Callbacks: `onReady`, `onMarked`, `onStateChange`, `onWarning`.

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
