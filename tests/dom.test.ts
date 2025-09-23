import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import * as stega from '@vercel/stega';
import { enableDatoVisualEditing } from '../src/index.js';

const { vercelStegaCombine } = stega;

const createRect = (x: number, y: number, width: number, height: number): DOMRect => ({
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
  if (!('requestAnimationFrame' in window)) {
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => setTimeout(() => cb(Date.now()), 0));
    vi.stubGlobal('cancelAnimationFrame', (id: number) => clearTimeout(id));
  }

  if (!('PointerEvent' in window)) {
    class StubPointerEvent extends MouseEvent {
      constructor(type: string, props?: MouseEventInit) {
        super(type, props);
      }
    }
    vi.stubGlobal('PointerEvent', StubPointerEvent as unknown as typeof PointerEvent);
  }
});

beforeEach(() => {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    configurable: true,
    value: (query: string) => ({
      media: query,
      matches: false,
      onchange: null,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      addListener: () => undefined,
      removeListener: () => undefined,
      dispatchEvent: () => false
    })
  });

  vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb: FrameRequestCallback) => {
    cb(0);
    return 0;
  });
  vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => undefined);
});

afterEach(() => {
  document.body.innerHTML = '';
  vi.restoreAllMocks();
});

describe('enableDatoVisualEditing', () => {
  it('highlights container targets and opens deep links on click', async () => {
    const payload = {
      cms: 'datocms',
      itemId: '123',
      itemTypeId: 'article',
      fieldPath: 'blocks.0.title'
    };
    const encoded = vercelStegaCombine('Headline', payload);

    document.body.innerHTML = `
      <div id="card" data-datocms-edit-target>
        <span id="title">${encoded}</span>
      </div>
    `;

    const card = document.getElementById('card')!;
    const title = document.getElementById('title')!;

    card.getBoundingClientRect = () => createRect(10, 20, 200, 60);
    title.getBoundingClientRect = () => createRect(40, 50, 100, 20);

    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null);

    const dispose = enableDatoVisualEditing({
      baseEditingUrl: 'https://acme.admin.datocms.com',
      environment: 'preview',
      activate: 'always',
      overlays: 'hover',
      showBadge: true,
      openInNewTab: false
    });

    title.dispatchEvent(new PointerEvent('pointerover', { bubbles: true }));
    await new Promise((resolve) => setTimeout(resolve, 0));

    const overlayRoot = document.body.lastElementChild as HTMLElement;
    expect(overlayRoot.style.transform).toBe('translate(10px, 20px)');

    title.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    expect(openSpy).toHaveBeenCalledWith(
      'https://acme.admin.datocms.com/environments/preview/editor/item_types/article/items/123/edit#fieldPath=blocks.0.title',
      '_self'
    );

    openSpy.mockClear();

    card.dispatchEvent(new PointerEvent('pointerover', { bubbles: true }));
    await new Promise((resolve) => setTimeout(resolve, 0));
    card.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    expect(openSpy).toHaveBeenCalledTimes(1);

    dispose();
  });

  it('uses prebuilt editUrl when provided', async () => {
    const editUrl = 'https://acme.admin.datocms.com/editor/item_types/article/items/123/edit#fieldPath=subtitle';
    const payload = {
      origin: 'datocms.com',
      href: editUrl,
    };
    const encoded = vercelStegaCombine('Subhead', payload);

    document.body.innerHTML = `<p id="subhead">${encoded}</p>`;
    const subhead = document.getElementById('subhead')!;
    subhead.getBoundingClientRect = () => createRect(0, 0, 100, 20);

    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null);

    const dispose = enableDatoVisualEditing({
      baseEditingUrl: 'https://acme.admin.datocms.com',
      activate: 'always',
      overlays: 'hover',
      showBadge: false,
      openInNewTab: true,
    });

    subhead.dispatchEvent(new PointerEvent('pointerover', { bubbles: true }));
    await new Promise((resolve) => setTimeout(resolve, 0));
    subhead.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));

    expect(openSpy).toHaveBeenCalledWith(editUrl, '_blank', 'noopener');

    dispose();
  });

  it('handles image alt metadata', async () => {
    const altPayload = { cms: 'datocms', itemId: 'asset_1', fieldPath: 'gallery.0.alt' };
    const encodedAlt = vercelStegaCombine('Hero image', altPayload);

    const img = document.createElement('img');
    img.setAttribute('alt', encodedAlt);
    img.getBoundingClientRect = () => createRect(5, 6, 150, 100);
    document.body.appendChild(img);

    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null);

    const dispose = enableDatoVisualEditing({
      baseEditingUrl: 'https://acme.admin.datocms.com',
      activate: 'always',
      overlays: 'hover',
      showBadge: false,
      openInNewTab: true
    });

    img.dispatchEvent(new PointerEvent('pointerover', { bubbles: true }));
    await new Promise((resolve) => setTimeout(resolve, 0));
    img.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));

    expect(openSpy).toHaveBeenCalledWith(
      'https://acme.admin.datocms.com/editor/items/asset_1/edit#fieldPath=gallery.0.alt',
      '_blank',
      'noopener'
    );

    dispose();
  });

  it('avoids redundant decoding for unchanged content', () => {
    const payload = { cms: 'datocms', itemId: 'u1' };
    const encoded = vercelStegaCombine('Snippet', payload);

    document.body.innerHTML = `<p id="copy">${encoded}</p>`;

    const decodeSpy = vi.spyOn(stega, 'vercelStegaDecode');

    const dispose = enableDatoVisualEditing({
      baseEditingUrl: 'https://acme.admin.datocms.com',
      activate: 'always',
      overlays: 'off',
      showBadge: false,
      openInNewTab: false
    });

    const initialCalls = decodeSpy.mock.calls.length;
    expect(initialCalls).toBeGreaterThan(0);

    const paragraph = document.getElementById('copy')!;
    paragraph.dispatchEvent(new PointerEvent('pointerover', { bubbles: true }));
    paragraph.dispatchEvent(new PointerEvent('pointerover', { bubbles: true }));

    expect(decodeSpy).toHaveBeenCalledTimes(initialCalls);

    dispose();
  });
});
