import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import * as stega from '@vercel/stega';
import { enableDatoVisualEditing } from '../src/index.js';
import * as decodeModule from '../src/decode/stega.js';

const { vercelStegaCombine } = stega;

const ATTR_EDIT_URL = 'data-datocms-edit-url';
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
  it('stamps editUrl from stega content and scrubs encoded markers', () => {
    const textPayload = {
      cms: 'datocms',
      editUrl: 'https://acme.admin.datocms.com/editor/items/hero123/edit#fieldPath=hero.title'
    };
    const imagePayload = {
      cms: 'datocms',
      editUrl: 'https://acme.admin.datocms.com/editor/items/hero123/edit#fieldPath=hero.image'
    };

    const encodedText = vercelStegaCombine('Hero headline', textPayload);
    const encodedAlt = vercelStegaCombine('Hero image alt', imagePayload);

    document.body.innerHTML = `
      <main>
        <p id="hero-text">${encodedText}</p>
        <img id="hero-image" alt="${encodedAlt}" src="hero.jpg">
      </main>
    `;

    const controller = enableDatoVisualEditing({});

    const heroText = document.getElementById('hero-text') as HTMLElement;
    const heroImage = document.getElementById('hero-image') as HTMLImageElement;

    expect(heroText.getAttribute(ATTR_EDIT_URL)).toBe(textPayload.editUrl);
    expect(heroText.getAttribute(ATTR_GENERATED)).toBe('stega');
    expect(heroText.textContent).toBe('Hero headline');

    const imageTarget = heroImage.closest<HTMLElement>(`[${ATTR_EDIT_URL}]`);
    expect(imageTarget).not.toBeNull();
    expect(imageTarget?.getAttribute(ATTR_EDIT_URL)).toBe(imagePayload.editUrl);
    expect(heroImage.getAttribute('alt')).toBe('Hero image alt');

    controller.dispose();

    expect(heroText.hasAttribute(ATTR_EDIT_URL)).toBe(false);
    expect(heroText.hasAttribute(ATTR_GENERATED)).toBe(false);
    expect(imageTarget?.hasAttribute(ATTR_EDIT_URL)).toBe(false);
  });

  it('skips stamping when editUrl is missing', () => {
    const payload = {
      cms: 'datocms',
      href: 'https://images.datocms-assets.com/fake/path/banner.png'
    };

    const encodedAlt = vercelStegaCombine('Hero banner', payload);

    document.body.innerHTML = `<img id="hero-banner" alt="${encodedAlt}" src="hero.jpg">`;

    const controller = enableDatoVisualEditing({});

    const heroBanner = document.getElementById('hero-banner') as HTMLImageElement;
    expect(heroBanner).not.toBeNull();

    expect(heroBanner?.hasAttribute(ATTR_EDIT_URL)).toBe(false);

    controller.dispose();
  });

  it('keeps overlay strictly attribute-based', () => {
    const payload = {
      cms: 'datocms',
      editUrl: 'https://acme.admin.datocms.com/editor/items/story42/edit#fieldPath=headline'
    };
    const encoded = vercelStegaCombine('Story headline', payload);

    document.body.innerHTML = `<h2 id="headline">${encoded}</h2>`;

    const element = document.getElementById('headline') as HTMLElement;
    element.getBoundingClientRect = () => createRect(20, 30, 160, 32);

    const decodeSpy = vi.spyOn(decodeModule, 'decodeStega');

    const controller = enableDatoVisualEditing({});

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
      payload.editUrl,
      '_blank',
      'noopener,noreferrer'
    );
    expect(decodeSpy).not.toHaveBeenCalled();

    controller.dispose();
  });

  it('re-marks new stega content via MutationObserver', async () => {
    document.body.innerHTML = `<section id="container"></section>`;
    const container = document.getElementById('container') as HTMLElement;

    const controller = enableDatoVisualEditing({});

    const payload = {
      cms: 'datocms',
      editUrl: 'https://acme.admin.datocms.com/editor/items/new567/edit#fieldPath=excerpt'
    };
    const encoded = vercelStegaCombine('Fresh content', payload);

    const paragraph = document.createElement('p');
    paragraph.id = 'dynamic';
    paragraph.textContent = encoded;
    container.appendChild(paragraph);

    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(paragraph.getAttribute(ATTR_EDIT_URL)).toBe(payload.editUrl);
    expect(paragraph.getAttribute(ATTR_GENERATED)).toBe('stega');
    expect(paragraph.textContent).toBe('Fresh content');

    controller.dispose();
  });

  it('warns when multiple stega payloads stamp the same element', () => {
    const firstPayload = {
      cms: 'datocms',
      editUrl: 'https://acme.admin.datocms.com/editor/items/node-1/edit#fieldPath=title'
    };
    const secondPayload = {
      cms: 'datocms',
      editUrl: 'https://acme.admin.datocms.com/editor/items/node-2/edit#fieldPath=subtitle'
    };

    const firstEncoded = vercelStegaCombine('Primary title', firstPayload);
    const secondEncoded = vercelStegaCombine('Secondary title', secondPayload);

    const collide = document.createElement('p');
    collide.id = 'collide';
    collide.append(document.createTextNode(firstEncoded));
    collide.append(document.createTextNode(secondEncoded));
    document.body.appendChild(collide);

    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const controller = enableDatoVisualEditing({});

    expect(collide.getAttribute(ATTR_EDIT_URL)).toBe(secondPayload.editUrl);

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
      ></div>
      <p id="encoded"></p>
    `;

    const encodedPayload = {
      cms: 'datocms',
      editUrl: 'https://acme.admin.datocms.com/editor/items/auto-1/edit#fieldPath=subheading'
    };

    const encoded = vercelStegaCombine('Subheading', encodedPayload);
    const encodedParagraph = document.getElementById('encoded') as HTMLElement;
    encodedParagraph.textContent = encoded;

    const controller = enableDatoVisualEditing({});

    const manual = document.getElementById('manual') as HTMLElement;
    expect(manual.getAttribute(ATTR_EDIT_URL)).toBe(
      'https://acme.admin.datocms.com/editor/items/manual-1/edit'
    );

    controller.dispose();

    expect(manual.getAttribute('data-datocms-edit-url')).toBe(
      'https://acme.admin.datocms.com/editor/items/manual-1/edit'
    );
    expect(encodedParagraph.hasAttribute(ATTR_EDIT_URL)).toBe(false);
  });

  it('honors wrapper targeting for text and zero-size images', () => {
    const textPayload = {
      cms: 'datocms',
      editUrl: 'https://acme.admin.datocms.com/editor/items/wrap-1/edit#fieldPath=wrapper.text'
    };
    const imgPayload = {
      cms: 'datocms',
      editUrl: 'https://acme.admin.datocms.com/editor/items/wrap-2/edit#fieldPath=wrapper.image'
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

    const controller = enableDatoVisualEditing({});

    const textWrapper = document.getElementById('text-wrapper') as HTMLElement;
    const innerSpan = document.getElementById('wrapped') as HTMLElement;

    expect(textWrapper.getAttribute(ATTR_EDIT_URL)).toBe(textPayload.editUrl);
    expect(innerSpan.hasAttribute(ATTR_EDIT_URL)).toBe(false);

    const imageWrapper = document.getElementById('image-wrapper') as HTMLElement;
    expect(imageWrapper.getAttribute(ATTR_EDIT_URL)).toBe(imgPayload.editUrl);
    expect(wrappedImage.getAttribute('alt')).toBe('Wrapped image');

    controller.dispose();
  });

  it('can disable and re-enable visual editing without losing context', () => {
    const firstPayload = {
      cms: 'datocms',
      editUrl: 'https://acme.admin.datocms.com/editor/items/item-1/edit#fieldPath=content.title'
    };
    const secondPayload = {
      cms: 'datocms',
      editUrl: 'https://acme.admin.datocms.com/editor/items/item-2/edit#fieldPath=content.title'
    };

    const firstEncoded = vercelStegaCombine('Primary title', firstPayload);
    const secondEncoded = vercelStegaCombine('Updated title', secondPayload);

    document.body.innerHTML = `<h1 id="headline">${firstEncoded}</h1>`;

    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const controller = enableDatoVisualEditing({});

    const heading = document.getElementById('headline') as HTMLElement;
    expect(heading.getAttribute(ATTR_EDIT_URL)).toBe(firstPayload.editUrl);
    expect(heading.textContent).toBe('Primary title');

    controller.disable();

    heading.textContent = secondEncoded;
    expect(heading.getAttribute(ATTR_EDIT_URL)).toBe(firstPayload.editUrl);
    expect(heading.textContent).toBe(secondEncoded);

    controller.enable();

    expect(heading.getAttribute(ATTR_EDIT_URL)).toBe(secondPayload.editUrl);
    expect(heading.textContent).toBe('Updated title');

    controller.dispose();
    warnSpy.mockRestore();
  });

  it('exposes state helpers for manual toggle flows', () => {
    document.body.innerHTML = `<p id="content"></p>`;

    const controller = enableDatoVisualEditing({
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
