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

  it('accepts alternate key shapes and parses IDs from URLs', () => {
    const url = 'https://acme.admin.datocms.com/editor/item_types/article/items/987/edit#fieldPath=content';

    const payload = {
      record_id: '987',
      item_type_id: 'article',
      path: 'content',
      env: 'preview',
      url
    };

    const encoded = vercelStegaCombine('Body copy', payload);
    const info = decodeStega(encoded);

    expect(info).toMatchObject({
      cms: 'datocms',
      itemId: '987',
      itemTypeId: 'article',
      fieldPath: 'content',
      environment: 'preview',
      editUrl: url
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
