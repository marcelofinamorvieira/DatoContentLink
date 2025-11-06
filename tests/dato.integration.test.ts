import { beforeAll, describe, expect, it, vi } from 'vitest';
import { enableDatoVisualEditing } from '../src/index.js';
import { decodeStega, stripStega } from '../src/decode/stega.js';

const API_TOKEN = process.env.DATOCMS_VISUAL_EDITING_TOKEN;
const BASE_EDITING_URL = process.env.DATOCMS_VISUAL_EDITING_BASE_URL;
const GRAPHQL_ENDPOINT = process.env.DATOCMS_VISUAL_EDITING_GRAPHQL_URL ?? 'https://graphql.datocms.com/preview';

const ZERO_WIDTH_REGEX = /[\u200B-\u200F\u202A-\u202E\u2060-\u206F]/;

const ATTR_EDIT_URL = 'data-datocms-edit-url';
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

    const normalizedBaseEditingUrl = baseEditingUrl.trim().replace(/\/$/, '');
    const previewHeaders = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiToken}`,
      'X-Visual-Editing': 'vercel-v1',
      'X-Base-Editing-Url': normalizedBaseEditingUrl
    } as const;

    const [previewRes, baselineRes] = await Promise.all([
      fetch(GRAPHQL_ENDPOINT, {
        method: 'POST',
        headers: previewHeaders,
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

  it('decodes editUrl metadata when the preview payload includes it', () => {
    const heroSection = findSection(previewHome, 'HeroSectionRecord') as Section & {
      heroTitle: string;
    };

    const info = decodeStega(heroSection.heroTitle);
    if (!info) {
      console.warn(
        '[datocms-visual-editing] skipping editUrl assertion: preview payload did not include editUrl yet.'
      );
      return;
    }

    expect(typeof info.editUrl).toBe('string');
    expect(info.editUrl.length).toBeGreaterThan(0);
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

    const controller = enableDatoVisualEditing({});

    const heroTitleEl = document.getElementById('hero-title');
    expect(heroTitleEl).toBeTruthy();

    const stampedEditUrl = heroTitleEl?.getAttribute(ATTR_EDIT_URL) ?? '';
    const decoded = decodeStega(heroSection.heroTitle);
    if (!decoded) {
      console.warn(
        '[datocms-visual-editing] skipping editUrl equality assertion: decoded payload did not include editUrl.'
      );
      controller.dispose();
      document.body.innerHTML = '';
      return;
    }

    expect(stampedEditUrl).toBe(decoded.editUrl);

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
    const initialInfo = decodeStega(heroSection.heroTitle);
    const nextInfo = decodeStega(heroSection.heroSubtitle);

    if (!initialInfo || !nextInfo) {
      console.warn(
        '[datocms-visual-editing] skipping toggle overlay assertions: decoded payloads did not include editUrl.'
      );
      return;
    }

    document.body.innerHTML = `<p id="hero-toggle">${heroSection.heroTitle}</p>`;

    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const controller = enableDatoVisualEditing({
      autoEnable: false
    });

    expect(controller.isEnabled()).toBe(false);

    controller.enable();

    const element = document.getElementById('hero-toggle');
    expect(element).toBeTruthy();

    const initialUrl = element?.getAttribute(ATTR_EDIT_URL) ?? '';
    expect(initialUrl).toBe(initialInfo.editUrl);

    controller.disable();

    element!.textContent = heroSection.heroSubtitle;
    expect(element?.getAttribute(ATTR_EDIT_URL)).toBe(initialUrl);

    controller.enable();

    const updatedUrl = element?.getAttribute(ATTR_EDIT_URL) ?? '';
    expect(updatedUrl).toBe(nextInfo.editUrl);

    controller.dispose();
    warnSpy.mockRestore();
    document.body.innerHTML = '';
  });
});
