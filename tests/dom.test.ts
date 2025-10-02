import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import * as stega from '@vercel/stega';
import { enableDatoVisualEditing, buildEditTagAttributes } from '../src/index.js';

const { vercelStegaCombine, vercelStegaSplit } = stega;

let textRectMap: WeakMap<Text, DOMRect[]>;
let originalElementsFromPoint: (typeof document.elementsFromPoint) | undefined;

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
  textRectMap = new WeakMap();

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

  vi.spyOn(document, 'createRange').mockImplementation(() => {
    let currentNode: Text | null = null;
    return {
      selectNodeContents(node: Node) {
        currentNode = node instanceof Text ? node : null;
      },
      getClientRects() {
        return currentNode ? textRectMap.get(currentNode) ?? [] : [];
      },
      getBoundingClientRect() {
        const rects = currentNode ? textRectMap.get(currentNode) ?? [] : [];
        return rects[0] ?? createRect(0, 0, 0, 0);
      }
    } as unknown as Range;
  });

  originalElementsFromPoint = typeof document.elementsFromPoint === 'function'
    ? document.elementsFromPoint.bind(document)
    : undefined;

  Object.defineProperty(document, 'elementsFromPoint', {
    configurable: true,
    writable: true,
    value: (clientX: number, clientY: number) => {
      const elements: Element[] = [];
      const all = document.querySelectorAll<HTMLElement>('*');
      for (const element of all) {
        if (typeof element.getBoundingClientRect !== 'function') {
          continue;
        }
        const rect = element.getBoundingClientRect();
        if (clientX >= rect.left && clientX <= rect.right && clientY >= rect.top && clientY <= rect.bottom) {
          elements.push(element);
        }
      }
      return elements;
    }
  });
});

afterEach(() => {
  document.body.innerHTML = '';
  if (originalElementsFromPoint) {
    Object.defineProperty(document, 'elementsFromPoint', {
      configurable: true,
      writable: true,
      value: originalElementsFromPoint
    });
  } else {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    delete (document as any).elementsFromPoint;
  }
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
    textRectMap.set(title.firstChild as Text, [createRect(40, 50, 100, 20)]);

    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null);

    const dispose = enableDatoVisualEditing({
      baseEditingUrl: 'https://acme.admin.datocms.com',
      environment: 'preview',
      activate: 'always',
      overlays: 'hover',
      showBadge: true,
      openInNewTab: false,
      hoverLingerMs: 0
    });

    title.dispatchEvent(new PointerEvent('pointerover', { bubbles: true, clientX: 80, clientY: 60 }));
    await new Promise((resolve) => setTimeout(resolve, 0));

    const overlayRoot = document.body.lastElementChild as HTMLElement;
    expect(overlayRoot.style.transform).toBe('translate(2px, 12px)');

    title.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, clientX: 80, clientY: 60 }));
    expect(openSpy).toHaveBeenCalledWith(
      'https://acme.admin.datocms.com/environments/preview/editor/item_types/article/items/123/edit#fieldPath=blocks.0.title',
      '_self'
    );

    openSpy.mockClear();

    card.dispatchEvent(new PointerEvent('pointerover', { bubbles: true, clientX: 80, clientY: 60 }));
    await new Promise((resolve) => setTimeout(resolve, 0));
    card.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, clientX: 80, clientY: 60 }));
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
    textRectMap.set(subhead.firstChild as Text, [createRect(0, 0, 100, 20)]);

    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null);

    const dispose = enableDatoVisualEditing({
      baseEditingUrl: 'https://acme.admin.datocms.com',
      activate: 'always',
      overlays: 'hover',
      showBadge: false,
      openInNewTab: true,
      hoverLingerMs: 0,
    });

    subhead.dispatchEvent(new PointerEvent('pointerover', { bubbles: true, clientX: 10, clientY: 10 }));
    await new Promise((resolve) => setTimeout(resolve, 0));
    subhead.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, clientX: 10, clientY: 10 }));

    expect(openSpy).toHaveBeenCalledWith(editUrl, '_blank', 'noopener');

    dispose();
  });

  it('logs debug details on overlay click when debug is enabled', async () => {
    const payload = {
      cms: 'datocms',
      itemId: '456',
      itemTypeId: 'article',
      fieldPath: 'excerpt'
    };
    const encoded = vercelStegaCombine('Snippet', payload);

    document.body.innerHTML = `<p id="snippet">${encoded}</p>`;
    const snippet = document.getElementById('snippet')!;
    snippet.getBoundingClientRect = () => createRect(0, 0, 120, 18);
    textRectMap.set(snippet.firstChild as Text, [createRect(0, 0, 120, 18)]);

    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null);
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    const dispose = enableDatoVisualEditing({
      baseEditingUrl: 'https://acme.admin.datocms.com',
      activate: 'always',
      overlays: 'hover',
      showBadge: false,
      openInNewTab: true,
      debug: true,
      hoverLingerMs: 0
    });

    snippet.dispatchEvent(new PointerEvent('pointerover', { bubbles: true, clientX: 30, clientY: 9 }));
    await new Promise((resolve) => setTimeout(resolve, 0));
    snippet.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, clientX: 30, clientY: 9 }));

    expect(openSpy).toHaveBeenCalledOnce();
    expect(logSpy).toHaveBeenCalledWith(
      '[datocms-visual-editing][debug] overlay click',
      expect.objectContaining({
        url: 'https://acme.admin.datocms.com/editor/item_types/article/items/456/edit#fieldPath=excerpt',
        info: expect.objectContaining({ itemId: '456', fieldPath: 'excerpt' })
      })
    );

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
      openInNewTab: true,
      hoverLingerMs: 0
    });

    img.dispatchEvent(new PointerEvent('pointerover', { bubbles: true, clientX: 20, clientY: 20 }));
    await new Promise((resolve) => setTimeout(resolve, 0));
    img.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, clientX: 20, clientY: 20 }));

    expect(openSpy).toHaveBeenCalledWith(
      'https://acme.admin.datocms.com/editor/items/asset_1/edit#fieldPath=gallery.0.alt',
      '_blank',
      'noopener'
    );

    dispose();
  });

  it('resolves image matches when hovering a wrapper container', async () => {
    const payload = { cms: 'datocms', itemId: 'asset_2', fieldPath: 'gallery.1.alt' };
    const encoded = vercelStegaCombine('Gallery item', payload);

    document.body.innerHTML = `
      <a id="wrapper" data-datocms-edit-target>
        <img id="photo" alt="${encoded}" />
      </a>
    `;

    const wrapper = document.getElementById('wrapper')!;
    const photo = document.getElementById('photo') as HTMLImageElement;

    wrapper.getBoundingClientRect = () => createRect(10, 20, 200, 120);
    photo.getBoundingClientRect = () => createRect(30, 40, 160, 80);

    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null);

    const dispose = enableDatoVisualEditing({
      baseEditingUrl: 'https://acme.admin.datocms.com',
      activate: 'always',
      overlays: 'hover',
      showBadge: true,
      openInNewTab: false,
      hoverLingerMs: 0
    });

    wrapper.dispatchEvent(new PointerEvent('pointerover', { bubbles: true, clientX: 60, clientY: 50 }));
    await new Promise((resolve) => setTimeout(resolve, 0));

    const overlayRoot = document.body.lastElementChild as HTMLElement;
    expect(overlayRoot.style.transform).toBe('translate(2px, 12px)');

    wrapper.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, clientX: 60, clientY: 50 }));
    expect(openSpy).toHaveBeenCalledWith(
      'https://acme.admin.datocms.com/editor/items/asset_2/edit#fieldPath=gallery.1.alt',
      '_self'
    );

    dispose();
  });

  it('falls back to container geometry when the image box is zero-sized', async () => {
    const payload = { cms: 'datocms', itemId: 'asset_3', fieldPath: 'gallery.2.alt' };
    const encoded = vercelStegaCombine('Gallery thumb', payload);

    document.body.innerHTML = `
      <figure id="frame" data-datocms-edit-target>
        <img id="thumb" alt="${encoded}" />
      </figure>
    `;

    const frame = document.getElementById('frame')!;
    const thumb = document.getElementById('thumb') as HTMLImageElement;

    frame.getBoundingClientRect = () => createRect(0, 0, 180, 90);
    thumb.getBoundingClientRect = () => createRect(0, 0, 0, 0);

    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null);

    const dispose = enableDatoVisualEditing({
      baseEditingUrl: 'https://acme.admin.datocms.com',
      activate: 'always',
      overlays: 'hover',
      showBadge: false,
      openInNewTab: false,
      hoverLingerMs: 0
    });

    frame.dispatchEvent(new PointerEvent('pointerover', { bubbles: true, clientX: 20, clientY: 20 }));
    await new Promise((resolve) => setTimeout(resolve, 0));

    const overlayRoot = document.body.lastElementChild as HTMLElement;
    expect(overlayRoot.style.transform).toBe('translate(-8px, -8px)');

    frame.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, clientX: 20, clientY: 20 }));
    expect(openSpy).toHaveBeenCalledWith(
      'https://acme.admin.datocms.com/editor/items/asset_3/edit#fieldPath=gallery.2.alt',
      '_self'
    );

    dispose();
  });

  it('honours explicit edit info JSON tags', async () => {
    const wrapper = document.createElement('div');
    wrapper.getBoundingClientRect = () => createRect(10, 20, 180, 60);
    wrapper.setAttribute('data-datocms-edit-target', '');

    const attrs = buildEditTagAttributes({
      editUrl: 'https://acme.admin.datocms.com/editor/items/900/edit#fieldPath=stats.count',
      locale: 'en'
    });
    Object.entries(attrs).forEach(([name, value]) => wrapper.setAttribute(name, value));

    wrapper.textContent = '42';
    document.body.appendChild(wrapper);

    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null);

    const dispose = enableDatoVisualEditing({
      baseEditingUrl: 'https://acme.admin.datocms.com',
      activate: 'always',
      overlays: 'hover',
      showBadge: false,
      openInNewTab: false,
      hoverLingerMs: 0
    });

    wrapper.dispatchEvent(new PointerEvent('pointerover', { bubbles: true, clientX: 40, clientY: 30 }));
    await new Promise((resolve) => setTimeout(resolve, 0));

    const overlayRoot = document.body.lastElementChild as HTMLElement;
    expect(overlayRoot.style.transform).toBe('translate(2px, 12px)');

    wrapper.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, clientX: 40, clientY: 30 }));
    expect(openSpy).toHaveBeenCalledWith(
      'https://acme.admin.datocms.com/editor/items/900/edit#fieldPath=stats.count.en',
      '_self'
    );

    dispose();
  });

  it('supports split attribute edit tags', async () => {
    document.body.innerHTML = `
      <div id="stat" data-datocms-edit-target data-datocms-field-path="metrics.views">
        <span class="value">1,024</span>
      </div>
    `;

    const stat = document.getElementById('stat')!;
    stat.getBoundingClientRect = () => createRect(15, 25, 140, 40);

    const attrs = buildEditTagAttributes(
      {
        itemId: 'record_42',
        itemTypeId: 'post',
        environment: 'staging'
      },
      'attrs'
    );
    Object.entries(attrs).forEach(([name, value]) => stat.setAttribute(name, value));

    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null);

    const dispose = enableDatoVisualEditing({
      baseEditingUrl: 'https://acme.admin.datocms.com',
      activate: 'always',
      overlays: 'hover',
      showBadge: true,
      openInNewTab: false,
      hoverLingerMs: 0
    });

    stat.dispatchEvent(new PointerEvent('pointerover', { bubbles: true, clientX: 50, clientY: 40 }));
    await new Promise((resolve) => setTimeout(resolve, 0));

    const overlayRoot = document.body.lastElementChild as HTMLElement;
    expect(overlayRoot.style.transform).toBe('translate(7px, 17px)');

    stat.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, clientX: 50, clientY: 40 }));
    expect(openSpy).toHaveBeenCalledWith(
      'https://acme.admin.datocms.com/environments/staging/editor/item_types/post/items/record_42/edit#fieldPath=metrics.views',
      '_self'
    );

    dispose();
  });

  it('prefers explicit field path attribute when present', async () => {
    const wrapper = document.createElement('div');
    wrapper.getBoundingClientRect = () => createRect(20, 30, 160, 50);
    wrapper.setAttribute('data-datocms-edit-target', '');
    wrapper.setAttribute(
      'data-datocms-edit-info',
      JSON.stringify({
        itemId: 'record_700',
        itemTypeId: 'stat',
        fieldPath: 'stats.count',
        editUrl: 'https://acme.admin.datocms.com/editor/item_types/stat/items/record_700/edit#fieldPath=stats.count',
        locale: 'en'
      })
    );
    wrapper.setAttribute('data-datocms-field-path', 'stats.total');
    wrapper.textContent = 'Total stats';
    document.body.appendChild(wrapper);

    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null);

    const dispose = enableDatoVisualEditing({
      baseEditingUrl: 'https://acme.admin.datocms.com',
      activate: 'always',
      overlays: 'hover',
      showBadge: false,
      openInNewTab: false,
      hoverLingerMs: 0
    });

    wrapper.dispatchEvent(new PointerEvent('pointerover', { bubbles: true, clientX: 60, clientY: 45 }));
    await new Promise((resolve) => setTimeout(resolve, 0));

    wrapper.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, clientX: 60, clientY: 45 }));
    expect(openSpy).toHaveBeenCalledWith(
      'https://acme.admin.datocms.com/editor/item_types/stat/items/record_700/edit#fieldPath=stats.total.en',
      '_self'
    );

    dispose();
  });

  it('keeps matches after stega markers are stripped', async () => {
    const payload = {
      cms: 'datocms',
      itemId: '123',
      itemTypeId: 'article',
      fieldPath: 'blocks.0.title'
    };
    const encoded = vercelStegaCombine('Headline', payload);
    const cleaned = vercelStegaSplit(encoded).cleaned;

    document.body.innerHTML = `
      <div id="card" data-datocms-edit-target>
        <span id="title">${encoded}</span>
      </div>
    `;

    const card = document.getElementById('card')!;
    const title = document.getElementById('title')!;
    const textNode = title.firstChild as Text;
    card.getBoundingClientRect = () => createRect(10, 20, 200, 60);
    title.getBoundingClientRect = () => createRect(40, 50, 100, 20);
    textRectMap.set(textNode, [createRect(40, 50, 100, 20)]);

    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null);

    const dispose = enableDatoVisualEditing({
      baseEditingUrl: 'https://acme.admin.datocms.com',
      environment: 'preview',
      activate: 'always',
      overlays: 'hover',
      showBadge: true,
      openInNewTab: false,
      hoverLingerMs: 0
    });

    title.dispatchEvent(new PointerEvent('pointerover', { bubbles: true, clientX: 80, clientY: 60 }));
    await new Promise((resolve) => setTimeout(resolve, 0));

    let overlayRoot = document.body.lastElementChild as HTMLElement;
    expect(overlayRoot.style.transform).toBe('translate(2px, 12px)');

    textNode.textContent = cleaned;
    await new Promise((resolve) => setTimeout(resolve, 0));

    title.dispatchEvent(new PointerEvent('pointerover', { bubbles: true, clientX: 80, clientY: 60 }));
    await new Promise((resolve) => setTimeout(resolve, 0));

    overlayRoot = document.body.lastElementChild as HTMLElement;
    expect(overlayRoot.style.transform).toBe('translate(2px, 12px)');

    title.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, clientX: 80, clientY: 60 }));
    expect(openSpy).toHaveBeenCalledWith(
      'https://acme.admin.datocms.com/environments/preview/editor/item_types/article/items/123/edit#fieldPath=blocks.0.title',
      '_self'
    );

    dispose();
  });

  it('drops matches when persistAfterClean is disabled', async () => {
    const payload = {
      cms: 'datocms',
      itemId: '123',
      itemTypeId: 'article',
      fieldPath: 'blocks.0.title'
    };
    const encoded = vercelStegaCombine('Headline', payload);
    const cleaned = vercelStegaSplit(encoded).cleaned;

    document.body.innerHTML = `<span id="title">${encoded}</span>`;

    const title = document.getElementById('title')!;
    const textNode = title.firstChild as Text;
    title.getBoundingClientRect = () => createRect(40, 50, 100, 20);
    textRectMap.set(textNode, [createRect(40, 50, 100, 20)]);

    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null);

    const dispose = enableDatoVisualEditing({
      baseEditingUrl: 'https://acme.admin.datocms.com',
      activate: 'always',
      overlays: 'hover',
      showBadge: true,
      openInNewTab: false,
      persistAfterClean: false,
      hoverLingerMs: 0
    });

    title.dispatchEvent(new PointerEvent('pointerover', { bubbles: true, clientX: 80, clientY: 60 }));
    await new Promise((resolve) => setTimeout(resolve, 0));

    let overlayRoot = document.body.lastElementChild as HTMLElement;
    expect(overlayRoot.style.transform).toBe('translate(32px, 42px)');

    textNode.textContent = cleaned;
    await new Promise((resolve) => setTimeout(resolve, 0));

    title.dispatchEvent(new PointerEvent('pointerover', { bubbles: true, clientX: 80, clientY: 60 }));
    await new Promise((resolve) => setTimeout(resolve, 0));

    overlayRoot = document.body.lastElementChild as HTMLElement;
    expect(overlayRoot.style.display).toBe('none');

    title.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, clientX: 80, clientY: 60 }));
    expect(openSpy).not.toHaveBeenCalled();

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
