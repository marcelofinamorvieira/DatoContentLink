import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import * as stega from '@vercel/stega';
import { enableDatoVisualEditing } from '../src/index.js';
import * as decodeModule from '../src/decode/stega.js';

const { vercelStegaCombine } = stega;

const ATTR_EDIT_URL = 'data-datocms-edit-url';
const ATTR_ITEM_ID = 'data-datocms-item-id';
const ATTR_ENV = 'data-datocms-environment';
const ATTR_LOCALE = 'data-datocms-locale';
const ATTR_GENERATED = 'data-datocms-generated';

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

    const controller = enableDatoVisualEditing({
      baseEditingUrl: 'https://acme.admin.datocms.com',
      environment: 'main'
    });

    const heroText = document.getElementById('hero-text') as HTMLElement;
    const heroImage = document.getElementById('hero-image') as HTMLImageElement;

    expect(heroText.getAttribute(ATTR_EDIT_URL)).toBe(
      'https://acme.admin.datocms.com/environments/main/editor/item_types/article/items/hero123/edit#fieldPath=hero.title.en'
    );
    expect(heroText.hasAttribute(ATTR_ITEM_ID)).toBe(false);
    expect(heroText.hasAttribute(ATTR_ENV)).toBe(false);
    expect(heroText.hasAttribute(ATTR_LOCALE)).toBe(false);
    expect(heroText.getAttribute(ATTR_GENERATED)).toBe('stega');
    expect(heroText.textContent).toBe('Hero headline');

    const imageWrapper = heroImage.closest(`[${ATTR_GENERATED}]`) as HTMLElement;
    expect(imageWrapper).not.toBeNull();
    expect(imageWrapper.getAttribute(ATTR_EDIT_URL)).toBe(
      'https://acme.admin.datocms.com/environments/main/editor/item_types/article/items/hero123/edit#fieldPath=hero.image'
    );
    expect(imageWrapper?.hasAttribute(ATTR_ITEM_ID)).toBe(false);
    expect(heroImage.getAttribute('alt')).toBe('Hero image alt');

    controller.dispose();

    expect(heroText.hasAttribute(ATTR_EDIT_URL)).toBe(false);
    expect(heroText.hasAttribute(ATTR_GENERATED)).toBe(false);
    expect(imageWrapper?.hasAttribute(ATTR_EDIT_URL)).toBe(false);
  });

  it('falls back to raw href when image payload omits itemId', () => {
    const payload = {
      cms: 'datocms',
      href: 'https://images.datocms-assets.com/fake/path/banner.png'
    };

    const encodedAlt = vercelStegaCombine('Hero banner', payload);

    document.body.innerHTML = `<img id="hero-banner" alt="${encodedAlt}" src="hero.jpg">`;

    const controller = enableDatoVisualEditing({
      baseEditingUrl: 'https://acme.admin.datocms.com',
      environment: 'main'
    });

    const heroBanner = document.getElementById('hero-banner') as HTMLImageElement;
    expect(heroBanner).not.toBeNull();

    expect(heroBanner?.getAttribute(ATTR_EDIT_URL)).toBe(payload.href);
    expect(heroBanner?.hasAttribute(ATTR_ITEM_ID)).toBe(false);
    expect(heroBanner?.hasAttribute(ATTR_ENV)).toBe(false);
    expect(heroBanner?.hasAttribute(ATTR_LOCALE)).toBe(false);

    controller.dispose();
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

    const controller = enableDatoVisualEditing({
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

    controller.dispose();
  });

  it('supports custom edit url resolvers', () => {
    const payload = {
      cms: 'datocms',
      itemId: 'story-custom',
      fieldPath: 'headline',
      editUrl: 'https://acme.admin.datocms.com/editor/items/story-custom/edit'
    };
    const encoded = vercelStegaCombine('Story headline', payload);

    document.body.innerHTML = `<h2 id="headline">${encoded}</h2>`;

    const resolver = vi.fn((info: any, ctx: { baseEditingUrl: string; environment?: string }) => {
      expect(ctx.baseEditingUrl).toBe('https://acme.admin.datocms.com');
      expect(ctx.environment).toBe('preview');
      return info.editUrl ? `${info.editUrl}?from=custom` : null;
    });

    const controller = enableDatoVisualEditing({
      baseEditingUrl: 'https://acme.admin.datocms.com',
      environment: 'preview',
      resolveEditUrl: resolver
    });

    const element = document.getElementById('headline') as HTMLElement;
    expect(element.getAttribute(ATTR_EDIT_URL)).toBe(
      'https://acme.admin.datocms.com/editor/items/story-custom/edit?from=custom'
    );
    expect(resolver).toHaveBeenCalledTimes(1);

    controller.dispose();
  });

  it('re-marks new stega content via MutationObserver', async () => {
    document.body.innerHTML = `<section id="container"></section>`;
    const container = document.getElementById('container') as HTMLElement;

    const controller = enableDatoVisualEditing({
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

    controller.dispose();
  });

  it('warns when multiple stega payloads stamp the same element', () => {
    const firstPayload = {
      cms: 'datocms',
      itemId: 'node-1',
      fieldPath: 'title'
    };
    const secondPayload = {
      cms: 'datocms',
      itemId: 'node-2',
      fieldPath: 'subtitle'
    };

    const firstEncoded = vercelStegaCombine('Primary title', firstPayload);
    const secondEncoded = vercelStegaCombine('Secondary title', secondPayload);

    const collide = document.createElement('p');
    collide.id = 'collide';
    collide.append(document.createTextNode(firstEncoded));
    collide.append(document.createTextNode(secondEncoded));
    document.body.appendChild(collide);

    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const controller = enableDatoVisualEditing({
      baseEditingUrl: 'https://acme.admin.datocms.com'
    });

    expect(collide.getAttribute(ATTR_EDIT_URL)).toBe(
      'https://acme.admin.datocms.com/editor/items/node-2/edit#fieldPath=subtitle'
    );

    expect(warnSpy).toHaveBeenCalledTimes(1);
    const [message, elementArg] = warnSpy.mock.calls[0];
    expect(message).toContain('Multiple stega payloads resolved to the same DOM element');
    expect(message).toContain('Previously stamped edit URL');
    expect(message).toContain('Incoming edit URL');
    expect(message).toContain('data-datocms-edit-target');
    expect(elementArg).toBe(collide);

    controller.dispose();
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

    const controller = enableDatoVisualEditing({
      baseEditingUrl: 'https://acme.admin.datocms.com'
    });

    const manual = document.getElementById('manual') as HTMLElement;
    expect(manual.getAttribute('data-datocms-item-id')).toBe('manual-1');

    controller.dispose();

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

    const controller = enableDatoVisualEditing({
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

    controller.dispose();
  });

  it('can disable and re-enable visual editing without losing context', () => {
    const firstPayload = {
      cms: 'datocms',
      itemId: 'item-1',
      fieldPath: 'content.title'
    };
    const secondPayload = {
      cms: 'datocms',
      itemId: 'item-2',
      fieldPath: 'content.title'
    };

    const firstEncoded = vercelStegaCombine('Primary title', firstPayload);
    const secondEncoded = vercelStegaCombine('Updated title', secondPayload);

    document.body.innerHTML = `<h1 id="headline">${firstEncoded}</h1>`;

    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const controller = enableDatoVisualEditing({
      baseEditingUrl: 'https://acme.admin.datocms.com'
    });

    const heading = document.getElementById('headline') as HTMLElement;
    expect(heading.getAttribute(ATTR_EDIT_URL)).toBe(
      'https://acme.admin.datocms.com/editor/items/item-1/edit#fieldPath=content.title'
    );
    expect(heading.textContent).toBe('Primary title');

    controller.disable();

    heading.textContent = secondEncoded;
    expect(heading.getAttribute(ATTR_EDIT_URL)).toBe(
      'https://acme.admin.datocms.com/editor/items/item-1/edit#fieldPath=content.title'
    );
    expect(heading.textContent).toBe(secondEncoded);

    controller.enable();

    expect(heading.getAttribute(ATTR_EDIT_URL)).toBe(
      'https://acme.admin.datocms.com/editor/items/item-2/edit#fieldPath=content.title'
    );
    expect(heading.textContent).toBe('Updated title');

    controller.dispose();
    warnSpy.mockRestore();
  });

  it('exposes state helpers for manual toggle flows', () => {
    document.body.innerHTML = `<p id="content"></p>`;

    const controller = enableDatoVisualEditing({
      baseEditingUrl: 'https://acme.admin.datocms.com',
      autoEnable: false
    });

    expect(controller.isEnabled()).toBe(false);
    expect(controller.isDisposed()).toBe(false);

    controller.enable();
    expect(controller.isEnabled()).toBe(true);

    controller.toggle();
    expect(controller.isEnabled()).toBe(false);

    controller.toggle();
    expect(controller.isEnabled()).toBe(true);

    controller.dispose();
    expect(controller.isDisposed()).toBe(true);
    expect(controller.isEnabled()).toBe(false);

    controller.enable();
    expect(controller.isEnabled()).toBe(false);
  });
});
