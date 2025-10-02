import { describe, expect, it } from 'vitest';
import { buildDatoDeepLink } from '../src/link/buildDatoDeepLink.js';
import { normalizeFieldPath } from '../src/link/fieldPath.js';
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

  it('merges locale into same-origin editUrl hash', () => {
    const info = baseInfo({
      editUrl: 'https://acme.admin.datocms.com/editor/items/123/edit#fieldPath=title',
      locale: 'fr'
    });
    expect(buildDatoDeepLink(info, BASE)).toBe(
      'https://acme.admin.datocms.com/editor/items/123/edit#fieldPath=title.fr'
    );
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

  it('adds locale segment to fieldPath hash when available', () => {
    const info = baseInfo({ fieldPath: 'name', locale: 'pt-BR' });
    const link = buildDatoDeepLink(info, BASE);
    expect(link).toBe('https://acme.admin.datocms.com/editor/items/123/edit#fieldPath=name.pt-BR');
  });

  it('retains existing locale segment on same-origin editUrl', () => {
    const info = baseInfo({
      editUrl: 'https://acme.admin.datocms.com/editor/items/123/edit#fieldPath=title.fr',
      fieldPath: 'title',
      locale: 'fr'
    });
    const link = buildDatoDeepLink(info, BASE);
    expect(link).toBe('https://acme.admin.datocms.com/editor/items/123/edit#fieldPath=title.fr');
  });

  it('avoids duplicating locale when fieldPath already includes it', () => {
    const info = baseInfo({ fieldPath: 'seo.description.fr', locale: 'fr' });
    const link = buildDatoDeepLink(info, BASE);
    expect(link).toBe(
      'https://acme.admin.datocms.com/editor/items/123/edit#fieldPath=seo.description.fr'
    );
  });
});

describe('normalizeFieldPath', () => {
  it('returns null for object inputs to avoid unstable ordering', () => {
    expect(normalizeFieldPath({ level: 'one' })).toBeNull();
  });
});
