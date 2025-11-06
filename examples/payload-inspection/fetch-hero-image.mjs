import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { existsSync } from 'node:fs';
import { config } from 'dotenv';
import { decodeStega, stripStega } from '../../dist/index.js';

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

const normalizedBaseEditingUrl = normalizeBaseEditingUrl(baseEditingUrl);

const HERO_IMAGE_QUERY = /* GraphQL */ `
  query VisualEditingHeroImage {
    home {
      id
      sections {
        __typename
        ... on HeroSectionRecord {
          id
          heroImage {
            alt
            url
          }
        }
      }
    }
  }
`;

const response = await fetch(endpoint, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
    'X-Visual-Editing': 'vercel-v1',
    'X-Base-Editing-Url': normalizedBaseEditingUrl
  },
  body: JSON.stringify({ query: HERO_IMAGE_QUERY })
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

const sections = payload.data?.home?.sections ?? [];
const heroSections = sections.filter((section) => section?.__typename === 'HeroSectionRecord');

if (!heroSections.length) {
  console.log('No HeroSectionRecord entries found in the home.sections array.');
  process.exit(0);
}

heroSections.forEach((section, index) => {
  const heroImage = section?.heroImage ?? null;
  const alt = heroImage?.alt ?? null;

  console.log('============================================================');
  console.log(`HeroSection ${index + 1}: id=${section?.id ?? '(missing)'}`);
  console.log(`Hero image URL: ${heroImage?.url ?? '(missing)'}`);
  console.log(`Visible alt: ${alt ? stripStega(alt) : '(missing)'}`);

  if (!alt) {
    console.log('No alt text provided, skipping decode.');
    return;
  }

  const decoded = decodeStega(alt);
  if (!decoded) {
    console.log('decodeStega returned null (no stega payload detected).');
    return;
  }

  console.log('Decoded payload:');
  console.log(JSON.stringify(decoded, null, 2));
});

function normalizeBaseEditingUrl(url) {
  const trimmed = url.trim();
  const sanitized = trimmed.endsWith('/') ? trimmed.slice(0, -1) : trimmed;

  try {
    const parsed = new URL(sanitized);
    return `${parsed.origin}${parsed.pathname.replace(/\/$/, '')}`;
  } catch {
    throw new Error('DATOCMS_VISUAL_EDITING_BASE_URL must be a valid URL');
  }
}
