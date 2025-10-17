import { describe, expect, it } from 'vitest';
import { vercelStegaCombine } from '@vercel/stega';
import {
  stripDatoImageAlt,
  decodeDatoImageAlt,
  withDatoImageAlt
} from '../../src/utils/imageAlt.js';

const BASE_URL =
  'https://acme.admin.datocms.com/editor/item_types/article/items/456/edit#fieldPath=seo.title';

describe('stripDatoImageAlt', () => {
  it('removes the stega payload while preserving the visible label', () => {
    const encoded = vercelStegaCombine('Hero image alt', {
      cms: 'datocms',
      itemId: '456',
      itemTypeId: 'article',
      fieldPath: 'seo.title',
      editUrl: BASE_URL
    });

    expect(stripDatoImageAlt(encoded)).toBe('Hero image alt');
  });

  it('returns the original string when no payload exists', () => {
    expect(stripDatoImageAlt('Plain alt text')).toBe('Plain alt text');
  });
});

describe('decodeDatoImageAlt', () => {
  it('decodes metadata from an encoded alt attribute', () => {
    const payload = {
      cms: 'datocms',
      itemId: '456',
      itemTypeId: 'article',
      fieldPath: 'seo.title',
      editUrl: BASE_URL
    };
    const encoded = vercelStegaCombine('Hero image alt', payload);
    expect(decodeDatoImageAlt(encoded)).toEqual({
      cms: 'datocms',
      itemId: '456',
      itemTypeId: 'article',
      fieldPath: 'seo.title',
      environment: null,
      locale: null,
      editUrl: BASE_URL,
      raw: payload
    });
  });

  it('returns null for empty or plain alt values', () => {
    expect(decodeDatoImageAlt('Plain alt text')).toBeNull();
    expect(decodeDatoImageAlt('')).toBeNull();
    expect(decodeDatoImageAlt(null)).toBeNull();
  });
});

describe('withDatoImageAlt', () => {
  it('returns both cleaned alt text and decoded info', () => {
    const payload = {
      origin: 'datocms.com',
      href: BASE_URL
    };
    const encoded = vercelStegaCombine('Card cover', payload);

    const result = withDatoImageAlt(encoded);
    expect(result.cleanedAlt).toBe('Card cover');
    expect(result.editInfo).toEqual({
      cms: 'datocms',
      itemId: '456',
      itemTypeId: 'article',
      fieldPath: 'seo.title',
      environment: null,
      locale: null,
      editUrl: BASE_URL,
      raw: payload
    });
  });

  it('normalises nullish values', () => {
    const result = withDatoImageAlt(undefined);
    expect(result).toEqual({ cleanedAlt: '', editInfo: null });
  });
});
