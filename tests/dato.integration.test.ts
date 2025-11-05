import { beforeAll, describe, expect, it, vi } from 'vitest';
import { vercelStegaDecode, vercelStegaSplit } from '@vercel/stega';

import { enableDatoVisualEditing } from '../src/index.js';
import { withContentLinkHeaders } from '../src/net/withContentLinkHeaders.js';
import { stripStega } from '../src/decode/stega.js';
import { buildDatoDeepLink } from '../src/link/buildDatoDeepLink.js';
import type { DecodedInfo } from '../src/decode/types.js';

const API_TOKEN = process.env.DATOCMS_VISUAL_EDITING_TOKEN;
const BASE_EDITING_URL = process.env.DATOCMS_VISUAL_EDITING_BASE_URL;
const GRAPHQL_ENDPOINT = process.env.DATOCMS_VISUAL_EDITING_GRAPHQL_URL ?? 'https://graphql.datocms.com/preview';

const ZERO_WIDTH_REGEX = /[\u200B-\u200F\u202A-\u202E\u2060-\u206F]/;

const ATTR_EDIT_URL = 'data-datocms-edit-url';
const ATTR_ITEM_ID = 'data-datocms-item-id';
const ATTR_ITEM_TYPE_ID = 'data-datocms-item-type-id';
const ATTR_GENERATED = 'data-datocms-generated';

if (typeof Document === 'undefined' && typeof window !== 'undefined' && window?.Document) {
  // eslint-disable-next-line no-eval
  (0, eval)('var Document = window.Document;');
}

const VISUAL_EDITING_QUERY = /* GraphQL */ `
  query VisualEditingSample {
    home {
      id
      sections {
        __typename
        ... on HeroSectionRecord {
          id
          heroTitle
          heroSubtitle
          socialLabel
        }
        ... on CollectionCardShowcaseSectionRecord {
          id
          pretitle
          title
          description
        }
        ... on MaterialShowcaseSectionRecord {
          id
          title
          description
          subDescription
        }
      }
    }
    layout {
      id
      footerTitle
      footerSubtitle
      copyrightText
    }
  }
`;

type Section = {
  __typename: string;
  [key: string]: unknown;
};

type HomeRecord = {
  id: string;
  sections: Section[];
};

type LayoutRecord = {
  id: string;
  footerTitle: string;
  footerSubtitle: string;
  copyrightText: string;
};

let previewHome: HomeRecord;
let previewLayout: LayoutRecord;
let baselineHome: HomeRecord;
let baselineLayout: LayoutRecord;

const integrationDescribe = !API_TOKEN || !BASE_EDITING_URL ? describe.skip : describe;

integrationDescribe('DatoCMS preview integration', () => {
  const apiToken = API_TOKEN as string;
  const baseEditingUrl = BASE_EDITING_URL as string;

  beforeAll(async () => {
    if (typeof Document === 'undefined' && typeof window !== 'undefined' && window?.Document) {
      // eslint-disable-next-line no-eval
      (0, eval)('var Document = window.Document;');
    }
    if (typeof globalThis.Document === 'undefined') {
      // Ensure the global Document constructor exists for code paths that rely on it.
      globalThis.Document =
        ((globalThis.window as typeof window | undefined)?.Document ??
          (document.constructor as typeof Document)) as typeof Document;
    }

    const fetchDato = withContentLinkHeaders(fetch, baseEditingUrl);

    const [previewRes, baselineRes] = await Promise.all([
      fetchDato(GRAPHQL_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiToken}`
        },
        body: JSON.stringify({ query: VISUAL_EDITING_QUERY })
      }),
      fetch(GRAPHQL_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiToken}`
        },
        body: JSON.stringify({ query: VISUAL_EDITING_QUERY })
      })
    ]);

    const previewJson = await previewRes.json();
    const baselineJson = await baselineRes.json();

    if (!previewRes.ok || previewJson.errors) {
      throw new Error(`Preview fetch failed: ${JSON.stringify(previewJson.errors ?? previewJson, null, 2)}`);
    }
    if (!baselineRes.ok || baselineJson.errors) {
      throw new Error(`Baseline fetch failed: ${JSON.stringify(baselineJson.errors ?? baselineJson, null, 2)}`);
    }

    previewHome = previewJson.data.home;
    previewLayout = previewJson.data.layout;
    baselineHome = baselineJson.data.home;
    baselineLayout = baselineJson.data.layout;
  });

function hasZeroWidthMetadata(value: string | undefined): boolean {
  return typeof value === 'string' && ZERO_WIDTH_REGEX.test(value);
}

function findSection(home: HomeRecord, typeName: string): Section | undefined {
  return home.sections.find((section) => section.__typename === typeName);
}

function parseDatoHref(href: string) {
  const url = new URL(href);
  const segments = url.pathname.split('/').filter(Boolean);
  const itemTypesIndex = segments.indexOf('item_types');
  const itemsIndex = segments.indexOf('items');
  const itemTypeId = itemTypesIndex >= 0 ? segments[itemTypesIndex + 1] : undefined;
  const itemId = itemsIndex >= 0 ? segments[itemsIndex + 1] : undefined;
  const hash = url.hash.startsWith('#') ? url.hash.slice(1) : url.hash;
  const fieldPath = hash.startsWith('fieldPath=') ? decodeURIComponent(hash.slice('fieldPath='.length)) : undefined;

  return { itemTypeId, itemId, fieldPath };
}

  it('returns preview strings that carry zero-width stega metadata', () => {
    const heroSection = findSection(previewHome, 'HeroSectionRecord');
    expect(heroSection).toBeDefined();

    expect(hasZeroWidthMetadata(heroSection?.heroTitle as string)).toBe(true);
    expect(hasZeroWidthMetadata(heroSection?.heroSubtitle as string)).toBe(true);

    const collectionSection = findSection(previewHome, 'CollectionCardShowcaseSectionRecord');
    expect(collectionSection).toBeDefined();
    expect(hasZeroWidthMetadata(collectionSection?.title as string)).toBe(true);
    expect(hasZeroWidthMetadata(collectionSection?.description as string)).toBe(true);

    expect(hasZeroWidthMetadata(previewLayout.footerTitle)).toBe(true);
    expect(hasZeroWidthMetadata(previewLayout.copyrightText)).toBe(true);
  });

  it('stripStega restores the published content verbatim', () => {
    const heroPreview = findSection(previewHome, 'HeroSectionRecord') as Section & {
      heroTitle: string;
      heroSubtitle: string;
    };
    const heroBaseline = findSection(baselineHome, 'HeroSectionRecord') as Section & {
      heroTitle: string;
      heroSubtitle: string;
    };

    expect(stripStega(heroPreview.heroTitle)).toBe(heroBaseline.heroTitle);
    expect(stripStega(heroPreview.heroSubtitle)).toBe(heroBaseline.heroSubtitle);

    const collectionPreview = findSection(previewHome, 'CollectionCardShowcaseSectionRecord') as Section & {
      title: string;
      description: string;
    };
    const collectionBaseline = findSection(baselineHome, 'CollectionCardShowcaseSectionRecord') as Section & {
      title: string;
      description: string;
    };

    expect(stripStega(collectionPreview.title)).toBe(collectionBaseline.title);
    expect(stripStega(collectionPreview.description)).toBe(collectionBaseline.description);

    expect(stripStega(previewLayout.footerTitle)).toBe(baselineLayout.footerTitle);
    expect(stripStega(previewLayout.footerSubtitle)).toBe(baselineLayout.footerSubtitle);
    expect(stripStega(previewLayout.copyrightText)).toBe(baselineLayout.copyrightText);
  });

  it('exposes deep-link metadata that can be normalized into editor URLs', () => {
    const heroSection = findSection(previewHome, 'HeroSectionRecord') as Section & {
      heroTitle: string;
    };
    const split = vercelStegaSplit(heroSection.heroTitle);
    expect(split.encoded).toBeDefined();

    const decoded = vercelStegaDecode(split.encoded ?? '') as { href?: string } | null;
    expect(decoded && typeof decoded.href === 'string').toBe(true);
    if (!decoded || typeof decoded.href !== 'string') {
      throw new Error('Decoded payload is missing href metadata.');
    }

    const href = decoded.href;
    const { itemTypeId, itemId, fieldPath } = parseDatoHref(href);
    expect(itemId).toBe(previewHome.id);
    expect(itemTypeId).toBeDefined();
    expect(fieldPath).toContain('hero_title');

    const info: DecodedInfo = {
      cms: 'datocms',
      itemId: itemId ?? '',
      itemTypeId,
      fieldPath,
      environment: null,
      locale: null,
      editUrl: href,
      raw: decoded
    };

    const deepLink = buildDatoDeepLink(info, baseEditingUrl);
    expect(deepLink).toBe(decoded.href);
  });

  it('stamps DOM attributes when given live stega payloads', () => {
    const heroSection = findSection(previewHome, 'HeroSectionRecord') as Section & {
      heroTitle: string;
    };

    document.body.innerHTML = `
      <article>
        <p id="hero-title">${heroSection.heroTitle}</p>
      </article>
    `;

    const controller = enableDatoVisualEditing({
      baseEditingUrl
    });

    const heroTitleEl = document.getElementById('hero-title');
    expect(heroTitleEl).toBeTruthy();

    const editUrl = heroTitleEl?.getAttribute(ATTR_EDIT_URL);
    expect(editUrl).not.toBeNull();
    const normalizedBase = baseEditingUrl.replace(/\/$/, '');
    expect((editUrl ?? '').startsWith(normalizedBase)).toBe(true);
    expect(heroTitleEl?.hasAttribute(ATTR_ITEM_ID)).toBe(false);
    expect(heroTitleEl?.hasAttribute(ATTR_ITEM_TYPE_ID)).toBe(false);
    expect(heroTitleEl?.getAttribute(ATTR_GENERATED)).toBe('stega');
    expect(heroTitleEl?.textContent).toBe(stripStega(heroSection.heroTitle));

    controller.dispose();
    document.body.innerHTML = '';
  });

  it('allows toggling overlays on demand', () => {
    const heroSection = findSection(previewHome, 'HeroSectionRecord') as Section & {
      heroTitle: string;
      heroSubtitle: string;
    };

    document.body.innerHTML = `<p id="hero-toggle">${heroSection.heroTitle}</p>`;

    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const controller = enableDatoVisualEditing({
      baseEditingUrl,
      autoEnable: false
    });

    expect(controller.isEnabled()).toBe(false);

    controller.enable();

    const element = document.getElementById('hero-toggle');
    expect(element).toBeTruthy();

    const initialUrl = element?.getAttribute(ATTR_EDIT_URL) ?? '';
    expect(initialUrl).toContain('hero');

    controller.disable();

    element!.textContent = heroSection.heroSubtitle;
    expect(element?.getAttribute(ATTR_EDIT_URL)).toBe(initialUrl);

    controller.enable();

    const updatedUrl = element?.getAttribute(ATTR_EDIT_URL) ?? '';
    expect(updatedUrl).not.toBe(initialUrl);
    expect(updatedUrl).toMatch(/hero[_-]?subtitle/i);

    controller.dispose();
    warnSpy.mockRestore();
    document.body.innerHTML = '';
  });
});
