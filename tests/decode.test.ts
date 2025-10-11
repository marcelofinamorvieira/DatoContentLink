import { describe, expect, it } from 'vitest';
import { vercelStegaCombine } from '@vercel/stega';
import { decodeStega, stripStega } from '../src/decode/stega.js';

const BASE_URL = 'https://acme.admin.datocms.com/editor/item_types/page/items/123/edit';

describe('decodeStega', () => {
  it('decodes payload with canonical keys', () => {
    const payload = {
      cms: 'datocms',
      itemId: '123',
      itemTypeId: 'page',
      fieldPath: 'title',
      locale: 'en',
      environment: 'staging',
      editUrl: BASE_URL
    };

    const encoded = vercelStegaCombine('Hello world', payload);
    const info = decodeStega(encoded);

    expect(info).toEqual({
      cms: 'datocms',
      itemId: '123',
      itemTypeId: 'page',
      fieldPath: 'title',
      locale: 'en',
      environment: 'staging',
      editUrl: BASE_URL,
      raw: payload
    });
  });

  it('returns null for strings without stega metadata', () => {
    expect(decodeStega('Plain text')).toBeNull();
  });
});

describe('stripStega', () => {
  it('removes encoded metadata without touching visible text', () => {
    const encoded = vercelStegaCombine('Visible', { itemId: '42' });
    expect(stripStega(encoded)).toBe('Visible');
  });
});
