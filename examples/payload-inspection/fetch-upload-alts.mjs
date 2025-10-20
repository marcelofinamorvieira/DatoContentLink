import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { existsSync } from 'node:fs';
import { config } from 'dotenv';
import {
  decodeStega,
  stripDatoImageAlt,
  withContentLinkHeaders
} from '../../dist/index.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const ENV_FILES = [
  '.env',
  '.env.local',
  '.env.visual-editing',
  '.env.visual-editing.local',
  'test/.env',
  'test/.env.local'
];

for (const candidate of ENV_FILES) {
  const filePath = path.resolve(process.cwd(), candidate);
  if (existsSync(filePath)) {
    config({ path: filePath, override: false });
  }
}

const baseEditingUrl = process.env.DATOCMS_VISUAL_EDITING_BASE_URL;
const token = process.env.DATOCMS_VISUAL_EDITING_TOKEN;
const endpoint =
  process.env.DATOCMS_VISUAL_EDITING_GRAPHQL_URL ?? 'https://graphql.datocms.com/preview';

if (!baseEditingUrl || !token) {
  console.error(
    'Missing DATOCMS_VISUAL_EDITING_BASE_URL or DATOCMS_VISUAL_EDITING_TOKEN. ' +
      'Populate .env (see .env.example) before running this script.'
  );
  process.exit(1);
}

const fetchDato = withContentLinkHeaders(fetch, baseEditingUrl);

const ASSET_QUERY = /* GraphQL */ `
  query VisualEditingAssetAlts {
    allUploads(first: 10) {
      id
      alt
      title
    }
  }
`;

const response = await fetchDato(endpoint, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`
  },
  body: JSON.stringify({ query: ASSET_QUERY })
});

if (!response.ok) {
  const text = await response.text();
  console.error('GraphQL request failed:', response.status, response.statusText, text);
  process.exit(1);
}

const payload = await response.json();

if (payload.errors) {
  console.error('GraphQL returned errors:', JSON.stringify(payload.errors, null, 2));
  process.exit(1);
}

const uploads = payload.data?.allUploads ?? [];

const decodedAlts = uploads
  .map((upload) => {
    const alt = typeof upload.alt === 'string' ? upload.alt : null;
    if (!alt) {
      return null;
    }
    const decoded = decodeStega(alt);
    if (!decoded) {
      return null;
    }
    const cleanedAlt = stripDatoImageAlt(alt);
    const origin = decoded.editUrl
      ? (() => {
          try {
            return new URL(decoded.editUrl).origin;
          } catch {
            return null;
          }
        })()
      : null;
    return {
      uploadId: upload.id,
      title: upload.title ?? null,
      cleanedAlt,
      decoded
    };
  })
  .filter((value) => Boolean(value));

if (!decodedAlts.length) {
  console.log('No steganographic payloads detected in the first 10 upload alts.');
  process.exit(0);
}

const missingItemId = decodedAlts.filter(
  (entry) => !entry.decoded.itemId || entry.decoded.itemId.trim().length === 0
);

console.log(`Decoded ${decodedAlts.length} image alt values from DatoCMS preview API.`);
console.log(
  `${missingItemId.length} of them are missing an itemId while carrying a fully-qualified editUrl:`
);

for (const entry of missingItemId) {
  const { uploadId, title, cleanedAlt, decoded } = entry;
  const origin = decoded.editUrl
    ? (() => {
        try {
          return new URL(decoded.editUrl).origin;
        } catch {
          return 'invalid-url';
        }
      })()
    : 'none';

  console.log('---');
  console.log(`Upload: ${uploadId}${title ? ` (${title})` : ''}`);
  console.log(`Visible alt: ${cleanedAlt}`);
  console.log(`Decoded itemId: ${decoded.itemId ?? '(missing)'}`);
  console.log(`Decoded itemTypeId: ${decoded.itemTypeId ?? '(missing)'}`);
  console.log(`Decoded editUrl: ${decoded.editUrl ?? '(missing)'}`);
  console.log(`Edit URL origin: ${origin}`);
}

const hasItemId = decodedAlts.filter(
  (entry) => entry.decoded.itemId && entry.decoded.itemId.trim().length > 0
);

if (hasItemId.length) {
  console.log('---');
  console.log('Payloads that include an itemId (for comparison):');
  for (const entry of hasItemId) {
    console.log(
      `${entry.uploadId}: itemId=${entry.decoded.itemId}, editUrl=${entry.decoded.editUrl}`
    );
  }
}
