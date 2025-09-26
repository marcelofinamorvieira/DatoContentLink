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
});
