import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { withContentLinkHeaders, decodeStega, stripStega } from '../dist/index.js';
import { buildDatoDeepLink } from '../dist/link/buildDatoDeepLink.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envFile = path.join(__dirname, '.env');

if (fs.existsSync(envFile)) {
  const lines = fs.readFileSync(envFile, 'utf8').split(/\r?\n/);
  for (const line of lines) {
    if (!line || line.trim().startsWith('#')) {
      continue;
    }
    const [key, ...rest] = line.split('=');
    if (key && rest.length) {
      const value = rest.join('=').trim();
      if (!(key in process.env) && value) {
        process.env[key.trim()] = value;
      }
    }
  }
}

const BASE_EDITING_URL = process.env.DATOCMS_EDIT_URL;
const API_TOKEN = process.env.DATOCMS_TOKEN;

if (!BASE_EDITING_URL || !API_TOKEN) {
  console.error('Missing DATOCMS_EDIT_URL or DATOCMS_TOKEN environment variables.');
  console.error('Set them in test/.env or pass inline, e.g.');
  console.error('  DATOCMS_EDIT_URL=https://yourproject.admin.datocms.com DATOCMS_TOKEN=xyz node test/inspectStega.mjs');
  process.exit(1);
}

const fetchDato = withContentLinkHeaders(fetch);

async function fetchGraphQL(query, variables) {
  const response = await fetchDato('https://graphql.datocms.com/', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${API_TOKEN}`,
      'X-Base-Editing-Url': BASE_EDITING_URL
    },
    body: JSON.stringify({ query, variables })
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`GraphQL request failed: ${response.status} ${response.statusText} — ${text}`);
  }

  const payload = await response.json();
  if (payload.errors) {
    const error = new Error('GraphQL errors');
    error.details = payload.errors;
    throw error;
  }

  return payload.data;
}

function unwrapType(type) {
  let current = type;
  while (current && current.ofType) {
    current = current.ofType;
  }
  return current;
}

async function getCandidateFields() {
  const data = await fetchGraphQL(`
    query QueryFields {
      __schema {
        queryType {
          fields {
            name
            args { name }
            type {
              kind
              name
              ofType {
                kind
                name
                ofType {
                  kind
                  name
                }
              }
            }
          }
        }
      }
    }
  `);

  return data.__schema.queryType.fields.filter((field) => {
    if (field.name.startsWith('all')) {
      return true;
    }
    if (field.type && field.type.kind === 'OBJECT') {
      return true;
    }
    const unwrapped = unwrapType(field.type);
    return unwrapped?.kind === 'OBJECT';
  });
}

async function getTypeFields(typeName) {
  const data = await fetchGraphQL(`
    query TypeFields($name: String!) {
      __type(name: $name) {
        name
        fields {
          name
          type {
            kind
            name
            ofType {
              kind
              name
              ofType {
                kind
                name
              }
            }
          }
        }
      }
    }
  `, { name: typeName });

  return data.__type?.fields ?? [];
}

function buildSelection(fields) {
  const parts = [];
  for (const field of fields) {
    const unwrapped = unwrapType(field.type);
    if (!unwrapped) continue;
    if (unwrapped.kind === 'SCALAR' && unwrapped.name === 'String') {
      parts.push(field.name);
    }
  }
  return parts.slice(0, 10).join('\n');
}

async function probeField(field) {
  const baseType = unwrapType(field.type);
  if (!baseType || baseType.kind !== 'OBJECT') {
    return null;
  }

  const typeFields = await getTypeFields(baseType.name);
  const selection = buildSelection(typeFields);
  if (!selection) {
    return null;
  }

  const args = [];
  if (field.args.some((arg) => arg.name === 'first')) {
    args.push('first: 2');
  }
  const fieldArgs = args.length ? `(${args.join(', ')})` : '';

  const query = `
    query ProbeField {
      ${field.name}${fieldArgs} {
        ${selection}
      }
    }
  `;

  try {
    const data = await fetchGraphQL(query);
    return data[field.name];
  } catch (error) {
    if (error.details) {
      console.warn(`Skipping ${field.name}:`, error.details.map((e) => e.message).join(' | '));
    } else {
      console.warn(`Skipping ${field.name}:`, error.message);
    }
    return null;
  }
}

function collectStrings(value, path = []) {
  const hits = [];
  if (typeof value === 'string') {
    hits.push({ value, path: path.join('.') || '(root)' });
    return hits;
  }
  if (Array.isArray(value)) {
    value.forEach((item, index) => {
      hits.push(...collectStrings(item, [...path, index]));
    });
    return hits;
  }
  if (value && typeof value === 'object') {
    Object.entries(value).forEach(([key, child]) => {
      hits.push(...collectStrings(child, [...path, key]));
    });
  }
  return hits;
}

async function main() {
  console.log('Fetching schema...');
  const fields = await getCandidateFields();
  console.log(`Found ${fields.length} candidate query fields`);

  const results = [];

  for (const field of fields) {
    const data = await probeField(field);
    if (!data) continue;
    const strings = collectStrings(data, [field.name]);
    for (const item of strings) {
      const decoded = decodeStega(item.value);
      if (decoded) {
        const cleaned = stripStega(item.value);
        const url = (() => {
          if (decoded.editUrl) {
            return decoded.editUrl;
          }
          try {
            return buildDatoDeepLink(decoded, BASE_EDITING_URL);
          } catch (error) {
            return 'Unable to build URL';
          }
        })();
        results.push({
          field: field.name,
          path: item.path,
          cleaned,
          decoded,
          url
        });
      }
    }
  }

  if (!results.length) {
    console.warn('No stega markers found – query more specific content or check that the headers are enabled.');
    return;
  }

  console.log(`\nDecoded ${results.length} stega strings:`);
  for (const result of results) {
    console.log('----------------------------------------');
    console.log(`Field: ${result.field}`);
    console.log(`Path: ${result.path}`);
    console.log(`Text: ${result.cleaned}`);
    console.log('Decoded:', result.decoded);
    console.log(`Deep link: ${result.url}`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
