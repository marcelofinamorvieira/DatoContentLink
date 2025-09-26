import { describe, expect, it } from 'vitest';
import { buildEditTagAttributes } from '../src/index.js';

describe('buildEditTagAttributes', () => {
  it('uses _editingUrl when provided and appends fieldPath fragment', () => {
    const attrs = buildEditTagAttributes({
      _editingUrl: 'https://acme.admin.datocms.com/editor/item_types/2124827/items/181050798/edit',
      fieldPath: ['seo', 'title']
    });

    const payload = JSON.parse(attrs['data-datocms-edit-info']);
    expect(payload.editUrl).toBe(
      'https://acme.admin.datocms.com/editor/item_types/2124827/items/181050798/edit#fieldPath=seo.title'
    );
    expect(payload.fieldPath).toBe('seo.title');
    expect(payload.itemId).toBeUndefined();
    expect(payload.itemTypeId).toBeUndefined();
  });

  it('produces explicit attributes with _editingUrl and fieldPath', () => {
    const attrs = buildEditTagAttributes(
      {
        _editingUrl: 'https://acme.admin.datocms.com/editor/item_types/2124827/items/181050798/edit',
        fieldPath: ['gallery', 0, 'alt']
      },
      'attrs'
    );

    expect(attrs['data-datocms-edit-url']).toBe(
      'https://acme.admin.datocms.com/editor/item_types/2124827/items/181050798/edit#fieldPath=gallery.0.alt'
    );
    expect(attrs['data-datocms-item-id']).toBeUndefined();
    expect(attrs['data-datocms-item-type-id']).toBeUndefined();
  });

  it('appends locale segment to fieldPath when provided', () => {
    const attrs = buildEditTagAttributes({
      itemId: '123',
      fieldPath: 'name',
      locale: 'en'
    });

    const payload = JSON.parse(attrs['data-datocms-edit-info']);
    expect(payload.fieldPath).toBe('name.en');
    expect(payload.locale).toBe('en');
  });

  it('merges locale into editUrl hash for explicit attrs format', () => {
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

  it('derives fieldPath from editUrl when missing and appends locale', () => {
    const attrs = buildEditTagAttributes({
      editUrl: 'https://acme.admin.datocms.com/editor/items/456/edit#fieldPath=title',
      locale: 'da'
    });

    const payload = JSON.parse(attrs['data-datocms-edit-info']);

    expect(payload.fieldPath).toBe('title.da');
    expect(payload.editUrl).toBe(
      'https://acme.admin.datocms.com/editor/items/456/edit#fieldPath=title.da'
    );
  });
});
