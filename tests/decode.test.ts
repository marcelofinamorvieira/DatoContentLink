import { describe, expect, it } from 'vitest';
import { vercelStegaCombine } from '@vercel/stega';
import { decodeStega, stripStega } from '../src/decode/stega.js';

const BASE_URL = 'https://acme.admin.datocms.com/editor/item_types/page/items/123/edit';

describe('decodeStega', () => {
  it('returns editUrl when present in the payload', () => {
    const payload = {
      cms: 'datocms',
      editUrl: BASE_URL
    };

    const encoded = vercelStegaCombine('Hello world', payload);
    const info = decodeStega(encoded);

    expect(info).toEqual({
      cms: 'datocms',
      editUrl: BASE_URL,
      raw: payload
    });
  });

  it('returns null for strings without stega metadata', () => {
    expect(decodeStega('Plain text')).toBeNull();
  });

  it('returns null when editUrl is missing', () => {
    const payload = {
      cms: 'datocms',
      href: 'https://acme.admin.datocms.com/editor/items/456/edit'
    };

    const encoded = vercelStegaCombine('Dato content', payload);
    expect(decodeStega(encoded)).toBeNull();
  });
});

describe('stripStega', () => {
  it('removes encoded metadata without touching visible text', () => {
    const encoded = vercelStegaCombine('Visible', { itemId: '42' });
    expect(stripStega(encoded)).toBe('Visible');
  });
});
