import { describe, expect, it } from 'vitest';
import { buildDatoDeepLink } from '../src/link/buildDatoDeepLink.js';
import type { DecodedInfo } from '../src/decode/types.js';

const BASE = 'https://acme.admin.datocms.com';

function baseInfo(partial: Partial<DecodedInfo> = {}): DecodedInfo {
  return {
    cms: 'datocms',
    itemId: '123',
    raw: {},
    ...partial
  };
}

describe('buildDatoDeepLink', () => {
  it('prefers editUrl on same origin', () => {
    const info = baseInfo({
      editUrl: 'https://acme.admin.datocms.com/editor/item_types/post/items/123/edit'
    });
    expect(buildDatoDeepLink(info, BASE)).toBe(info.editUrl);
  });

  it('builds link with item type and environment option', () => {
    const info = baseInfo({ itemTypeId: 'post' });
    const link = buildDatoDeepLink(info, BASE, 'preview');
    expect(link).toBe(
      'https://acme.admin.datocms.com/environments/preview/editor/item_types/post/items/123/edit'
    );
  });

  it('falls back to info environment and appends fieldPath hash', () => {
    const info = baseInfo({
      itemTypeId: 'post',
      fieldPath: 'blocks.0.title',
      environment: 'staging'
    });
    const link = buildDatoDeepLink(info, BASE);
    expect(link).toBe(
      'https://acme.admin.datocms.com/environments/staging/editor/item_types/post/items/123/edit#fieldPath=blocks.0.title'
    );
  });

  it('uses items path when itemTypeId missing', () => {
    const info = baseInfo();
    const link = buildDatoDeepLink(info, BASE);
    expect(link).toBe('https://acme.admin.datocms.com/editor/items/123/edit');
  });
});
