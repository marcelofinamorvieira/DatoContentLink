import { describe, expect, it } from 'vitest';
import { trimmedOrNull, trimmedOrUndefined } from '../../src/utils/string.js';
import { normalizeBaseUrl, stripTrailingSlash } from '../../src/utils/url.js';
import { hasGeneratedAttribute, resolveDocument, setAttributesIfChanged } from '../../src/utils/dom.js';
import { isDevelopment } from '../../src/utils/env.js';
import { ATTR_GENERATED, GENERATED_VALUE } from '../../src/constants.js';

describe('string utils', () => {
  it('normalises strings to undefined when empty', () => {
    expect(trimmedOrUndefined(undefined)).toBeUndefined();
    expect(trimmedOrUndefined('')).toBeUndefined();
    expect(trimmedOrUndefined('   ')).toBeUndefined();
    expect(trimmedOrUndefined('value')).toBe('value');
  });

  it('normalises strings to null when empty', () => {
    expect(trimmedOrNull(undefined)).toBeNull();
    expect(trimmedOrNull(null)).toBeNull();
    expect(trimmedOrNull('')).toBeNull();
    expect(trimmedOrNull('  ')).toBeNull();
    expect(trimmedOrNull('value')).toBe('value');
  });
});

describe('url utils', () => {
  it('normalises base URLs', () => {
    expect(normalizeBaseUrl('https://acme.admin.datocms.com/')).toBe('https://acme.admin.datocms.com');
    expect(normalizeBaseUrl('https://acme.admin.datocms.com/editor/')).toBe('https://acme.admin.datocms.com/editor');
  });

  it('throws when base URL is missing or invalid', () => {
    expect(() => normalizeBaseUrl('')).toThrow('baseEditingUrl is required');
    expect(() => normalizeBaseUrl('not-a-url')).toThrow('baseEditingUrl must be a valid URL');
  });

  it('strips trailing slashes', () => {
    expect(stripTrailingSlash('https://example.com/')).toBe('https://example.com');
    expect(stripTrailingSlash('https://example.com/path')).toBe('https://example.com/path');
  });
});

describe('dom utils', () => {
  it('resolves documents from various roots', () => {
    expect(resolveDocument(document)).toBe(document);
    expect(resolveDocument(document.body)).toBe(document);
  });

  it('checks and sets generated attributes', () => {
    const el = document.createElement('div');
    expect(hasGeneratedAttribute(el)).toBe(false);

    el.setAttribute(ATTR_GENERATED, GENERATED_VALUE);
    expect(hasGeneratedAttribute(el)).toBe(true);

    el.removeAttribute(ATTR_GENERATED);
    const changed = setAttributesIfChanged(el, { [ATTR_GENERATED]: GENERATED_VALUE, foo: 'bar' });
    expect(changed).toBe(true);
    expect(el.getAttribute(ATTR_GENERATED)).toBe(GENERATED_VALUE);

    const unchanged = setAttributesIfChanged(el, { [ATTR_GENERATED]: GENERATED_VALUE });
    expect(unchanged).toBe(false);
  });
});

describe('env utils', () => {
  const originalProcess = globalThis.process;

  afterEach(() => {
  if (originalProcess === undefined) {
    // @ts-expect-error – restore absence of process
    delete globalThis.process;
  } else {
    globalThis.process = originalProcess;
  }
  });

  it('defaults to development when process is undefined', () => {
    // @ts-expect-error – simulate undefined process
    delete globalThis.process;
    expect(isDevelopment()).toBe(true);
  });

  it('detects production mode', () => {
    // @ts-expect-error – allow mutation for tests
    globalThis.process = { env: { NODE_ENV: 'production' } };
    expect(isDevelopment()).toBe(false);
  });

  it('defaults to development when NODE_ENV is unset', () => {
    // @ts-expect-error – allow mutation for tests
    globalThis.process = { env: {} };
    expect(isDevelopment()).toBe(true);
  });

  it('returns true for non-production NODE_ENV', () => {
    // @ts-expect-error – allow mutation for tests
    globalThis.process = { env: { NODE_ENV: 'test' } };
    expect(isDevelopment()).toBe(true);
  });
});

