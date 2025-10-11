import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import * as stega from '@vercel/stega';
import {
  enableDatoVisualEditing,
  ATTR_EDIT_URL,
  ATTR_ITEM_ID,
  ATTR_ENV,
  ATTR_LOCALE,
  ATTR_GENERATED
} from '../src/index.js';
import * as decodeModule from '../src/decode/stega.js';

const { vercelStegaCombine } = stega;

const createRect = (x: number, y: number, width: number, height: number): DOMRect =>
  ({
    x,
    y,
    width,
    height,
    top: y,
    left: x,
    right: x + width,
    bottom: y + height,
    toJSON() {
      return { x, y, width, height };
    }
  } as DOMRect);

beforeAll(() => {
  if (!('PointerEvent' in window)) {
    class PointerEventPolyfill extends MouseEvent {
      constructor(type: string, props?: MouseEventInit) {
        super(type, props);
      }
    }
    // @ts-expect-error polyfill assignment for tests
    window.PointerEvent = PointerEventPolyfill;
  }
});

beforeEach(() => {
  vi.spyOn(window, 'open').mockImplementation(() => null);
});

afterEach(() => {
  document.body.innerHTML = '';
  vi.restoreAllMocks();
});

describe('enableDatoVisualEditing', () => {
  it('stamps attributes from stega content and scrubs encoded markers', () => {
    const textPayload = {
      cms: 'datocms',
      itemId: 'hero123',
      itemTypeId: 'article',
      fieldPath: 'hero.title',
      locale: 'en'
    };
    const imagePayload = {
      cms: 'datocms',
      itemId: 'hero123',
      itemTypeId: 'article',
      fieldPath: 'hero.image'
    };

    const encodedText = vercelStegaCombine('Hero headline', textPayload);
    const encodedAlt = vercelStegaCombine('Hero image alt', imagePayload);

    document.body.innerHTML = `
      <main>
        <p id="hero-text">${encodedText}</p>
        <img id="hero-image" alt="${encodedAlt}" src="hero.jpg">
      </main>
    `;

    const dispose = enableDatoVisualEditing({
      baseEditingUrl: 'https://acme.admin.datocms.com',
      environment: 'main'
    });

    const heroText = document.getElementById('hero-text') as HTMLElement;
    const heroImage = document.getElementById('hero-image') as HTMLImageElement;

    expect(heroText.getAttribute(ATTR_EDIT_URL)).toBe(
      'https://acme.admin.datocms.com/environments/main/editor/item_types/article/items/hero123/edit#fieldPath=hero.title.en'
    );
    expect(heroText.getAttribute(ATTR_ITEM_ID)).toBe('hero123');
    expect(heroText.getAttribute(ATTR_ENV)).toBe('main');
    expect(heroText.getAttribute(ATTR_LOCALE)).toBe('en');
    expect(heroText.getAttribute(ATTR_GENERATED)).toBe('stega');
    expect(heroText.textContent).toBe('Hero headline');

    const imageWrapper = heroImage.closest(`[${ATTR_GENERATED}]`) as HTMLElement;
    expect(imageWrapper).not.toBeNull();
    expect(imageWrapper.getAttribute(ATTR_EDIT_URL)).toBe(
      'https://acme.admin.datocms.com/environments/main/editor/item_types/article/items/hero123/edit#fieldPath=hero.image'
    );
    expect(heroImage.getAttribute('alt')).toBe('Hero image alt');

    dispose();

    expect(heroText.hasAttribute(ATTR_EDIT_URL)).toBe(false);
    expect(heroText.hasAttribute(ATTR_GENERATED)).toBe(false);
    expect(imageWrapper?.hasAttribute(ATTR_EDIT_URL)).toBe(false);
  });

  it('keeps overlay strictly attribute-based', () => {
    const payload = {
      cms: 'datocms',
      itemId: 'story42',
      itemTypeId: 'blog_post',
      fieldPath: 'headline'
    };
    const encoded = vercelStegaCombine('Story headline', payload);

    document.body.innerHTML = `<h2 id="headline">${encoded}</h2>`;

    const element = document.getElementById('headline') as HTMLElement;
    element.getBoundingClientRect = () => createRect(20, 30, 160, 32);

    const decodeSpy = vi.spyOn(decodeModule, 'decodeStega');

    const dispose = enableDatoVisualEditing({
      baseEditingUrl: 'https://acme.admin.datocms.com'
    });

    decodeSpy.mockClear();

    element.dispatchEvent(
      new PointerEvent('pointerover', {
        bubbles: true,
        pointerType: 'mouse',
        clientX: 24,
        clientY: 36
      })
    );
    element.dispatchEvent(
      new MouseEvent('click', {
        bubbles: true,
        cancelable: true,
        button: 0,
        clientX: 24,
        clientY: 36
      })
    );

    expect(window.open).toHaveBeenCalledWith(
      'https://acme.admin.datocms.com/editor/item_types/blog_post/items/story42/edit#fieldPath=headline',
      '_blank',
      'noopener,noreferrer'
    );
    expect(decodeSpy).not.toHaveBeenCalled();

    dispose();
  });

  it('re-marks new stega content via MutationObserver', async () => {
    document.body.innerHTML = `<section id="container"></section>`;
    const container = document.getElementById('container') as HTMLElement;

    const dispose = enableDatoVisualEditing({
      baseEditingUrl: 'https://acme.admin.datocms.com'
    });

    const payload = {
      cms: 'datocms',
      itemId: 'new567',
      fieldPath: 'excerpt'
    };
    const encoded = vercelStegaCombine('Fresh content', payload);

    const paragraph = document.createElement('p');
    paragraph.id = 'dynamic';
    paragraph.textContent = encoded;
    container.appendChild(paragraph);

    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(paragraph.getAttribute(ATTR_EDIT_URL)).toBe(
      'https://acme.admin.datocms.com/editor/items/new567/edit#fieldPath=excerpt'
    );
    expect(paragraph.getAttribute(ATTR_GENERATED)).toBe('stega');
    expect(paragraph.textContent).toBe('Fresh content');

    dispose();
  });

  it('only removes generated attributes on dispose', () => {
    document.body.innerHTML = `
      <div
        id="manual"
        data-datocms-edit-url="https://acme.admin.datocms.com/editor/items/manual-1/edit"
        data-datocms-item-id="manual-1"
      ></div>
      <p id="encoded"></p>
    `;

    const encodedPayload = {
      cms: 'datocms',
      itemId: 'auto-1',
      fieldPath: 'subheading'
    };

    const encoded = vercelStegaCombine('Subheading', encodedPayload);
    const encodedParagraph = document.getElementById('encoded') as HTMLElement;
    encodedParagraph.textContent = encoded;

    const dispose = enableDatoVisualEditing({
      baseEditingUrl: 'https://acme.admin.datocms.com'
    });

    const manual = document.getElementById('manual') as HTMLElement;
    expect(manual.getAttribute('data-datocms-item-id')).toBe('manual-1');

    dispose();

    expect(manual.getAttribute('data-datocms-edit-url')).toBe(
      'https://acme.admin.datocms.com/editor/items/manual-1/edit'
    );
    expect(manual.getAttribute('data-datocms-item-id')).toBe('manual-1');
    expect(encodedParagraph.hasAttribute(ATTR_EDIT_URL)).toBe(false);
  });

  it('honors wrapper targeting for text and zero-size images', () => {
    const textPayload = {
      cms: 'datocms',
      itemId: 'wrap-1',
      fieldPath: 'wrapper.text'
    };
    const imgPayload = {
      cms: 'datocms',
      itemId: 'wrap-2',
      fieldPath: 'wrapper.image'
    };

    const encodedText = vercelStegaCombine('Wrapped text', textPayload);
    const encodedAlt = vercelStegaCombine('Wrapped image', imgPayload);

    document.body.innerHTML = `
      <div id="text-wrapper" data-datocms-edit-target>
        <span id="wrapped">${encodedText}</span>
      </div>
      <div id="image-wrapper" data-datocms-edit-target>
        <img id="wrapped-image" alt="${encodedAlt}" src="#">
      </div>
    `;

    const wrappedImage = document.getElementById('wrapped-image') as HTMLImageElement;
    wrappedImage.getBoundingClientRect = () => createRect(0, 0, 0, 0);

    const dispose = enableDatoVisualEditing({
      baseEditingUrl: 'https://acme.admin.datocms.com'
    });

    const textWrapper = document.getElementById('text-wrapper') as HTMLElement;
    const innerSpan = document.getElementById('wrapped') as HTMLElement;

    expect(textWrapper.getAttribute(ATTR_EDIT_URL)).toBe(
      'https://acme.admin.datocms.com/editor/items/wrap-1/edit#fieldPath=wrapper.text'
    );
    expect(innerSpan.hasAttribute(ATTR_EDIT_URL)).toBe(false);

    const imageWrapper = document.getElementById('image-wrapper') as HTMLElement;
    expect(imageWrapper.getAttribute(ATTR_EDIT_URL)).toBe(
      'https://acme.admin.datocms.com/editor/items/wrap-2/edit#fieldPath=wrapper.image'
    );
    expect(wrappedImage.getAttribute('alt')).toBe('Wrapped image');

    dispose();
  });
});
