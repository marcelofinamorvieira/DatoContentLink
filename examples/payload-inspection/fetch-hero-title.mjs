import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { existsSync } from 'node:fs';
import { config } from 'dotenv';
import { decodeStega, stripStega, withContentLinkHeaders } from '../../dist/index.js';

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

const HERO_TITLE_QUERY = /* GraphQL */ `
  query VisualEditingHeroTitle {
    home {
      id
      sections {
        __typename
        ... on HeroSectionRecord {
          id
          heroTitle
          heroImage {
            alt
          }
        }
      }
    }
  }
`;

const response = await fetchDato(endpoint, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`
  },
  body: JSON.stringify({ query: HERO_TITLE_QUERY })
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
  const title = typeof section?.heroTitle === 'string' ? section.heroTitle : null;

  console.log('============================================================');
  console.log(`HeroSection ${index + 1}: id=${section?.id ?? '(missing)'}`);
  console.log(
    `Visible heroTitle: ${title ? stripStega(title) : '(missing or not a string)'}`
  );

  if (!title) {
    console.log('heroTitle is missing, skipping decode.');
    return;
  }

  const decoded = decodeStega(title);
  if (!decoded) {
    console.log('decodeStega returned null (no stega payload detected in heroTitle).');
  } else {
    console.log('Decoded heroTitle payload:');
    console.log(JSON.stringify(decoded, null, 2));
  }

  const heroImageAlt = section?.heroImage?.alt ?? null;
  if (typeof heroImageAlt === 'string' && heroImageAlt.length > 0) {
    const decodedAlt = decodeStega(heroImageAlt);
    console.log('Decoded heroImage.alt payload:');
    console.log(decodedAlt ? JSON.stringify(decodedAlt, null, 2) : '(no payload)');
  }
});
