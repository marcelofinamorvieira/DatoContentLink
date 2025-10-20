import { describe, expect, it } from 'vitest';
import { buildEditTagAttributes } from '../src/index.js';

describe('buildEditTagAttributes', () => {
  it('returns only the edit url attribute by default', () => {
    const attrs = buildEditTagAttributes({
      _editingUrl: 'https://acme.admin.datocms.com/editor/item_types/2124827/items/181050798/edit',
      fieldPath: ['seo', 'title']
    });

    expect(attrs['data-datocms-edit-url']).toBe(
      'https://acme.admin.datocms.com/editor/item_types/2124827/items/181050798/edit#fieldPath=seo.title'
    );
    expect(Object.keys(attrs)).toEqual(['data-datocms-edit-url']);
  });

  it('exposes metadata payload when json format is requested', () => {
    const attrs = buildEditTagAttributes(
      {
        _editingUrl: 'https://acme.admin.datocms.com/editor/item_types/2124827/items/181050798/edit',
        fieldPath: ['gallery', 0, 'alt']
      },
      'json'
    );

    const payload = JSON.parse(attrs['data-datocms-edit-info']);
    expect(payload.editUrl).toBe(
      'https://acme.admin.datocms.com/editor/item_types/2124827/items/181050798/edit#fieldPath=gallery.0.alt'
    );
    expect(payload.fieldPath).toBe('gallery.0.alt');
  });

  it('produces explicit attributes with metadata when attrs format is requested', () => {
    const attrs = buildEditTagAttributes(
      {
        _editingUrl: 'https://acme.admin.datocms.com/editor/items/321/edit',
        fieldPath: 'seo.title',
        locale: 'it'
      },
      'attrs'
    );

    expect(attrs['data-datocms-edit-url']).toBe(
      'https://acme.admin.datocms.com/editor/items/321/edit#fieldPath=seo.title.it'
    );
    expect(attrs['data-datocms-locale']).toBe('it');
  });

  it('derives locale-adjusted fieldPath for json format', () => {
    const attrs = buildEditTagAttributes(
      {
        editUrl: 'https://acme.admin.datocms.com/editor/items/456/edit#fieldPath=title',
        locale: 'da'
      },
      'json'
    );

    const payload = JSON.parse(attrs['data-datocms-edit-info']);
    expect(payload.fieldPath).toBe('title.da');
    expect(payload.editUrl).toBe(
      'https://acme.admin.datocms.com/editor/items/456/edit#fieldPath=title.da'
    );
  });
});
