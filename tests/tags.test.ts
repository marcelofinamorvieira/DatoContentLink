import { describe, expect, it } from 'vitest';
import { buildEditTagAttributes } from '../src/index.js';

describe('buildEditTagAttributes', () => {
  it('returns the edit url attribute when provided', () => {
    const attrs = buildEditTagAttributes({
      editUrl: 'https://acme.admin.datocms.com/editor/items/181050798/edit'
    });

    expect(attrs['data-datocms-edit-url']).toBe(
      'https://acme.admin.datocms.com/editor/items/181050798/edit'
    );
    expect(Object.keys(attrs)).toEqual(['data-datocms-edit-url']);
  });

  it('trims the edit url before stamping', () => {
    const attrs = buildEditTagAttributes({
      editUrl: '  https://acme.admin.datocms.com/editor/items/321/edit  '
    });

    expect(attrs['data-datocms-edit-url']).toBe(
      'https://acme.admin.datocms.com/editor/items/321/edit'
    );
  });

  it('returns an empty object when edit url is missing', () => {
    expect(buildEditTagAttributes({})).toEqual({});
  });
});
