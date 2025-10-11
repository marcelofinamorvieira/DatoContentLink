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
  window.localStorage.clear();
  window.history.replaceState({}, '', '/');
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
  it('activates when the query toggle is present and truthy', async () => {
    const payload = {
      cms: 'datocms',
      itemId: 'query123',
      itemTypeId: 'article',
      fieldPath: 'title'
    };
    const encoded = vercelStegaCombine('Query headline', payload);

    window.history.replaceState({}, '', '/blog?edit=1');

    document.body.innerHTML = `<h1 id="headline">${encoded}</h1>`;
    const headline = document.getElementById('headline')!;
    headline.getBoundingClientRect = () => createRect(20, 30, 120, 28);
    textRectMap.set(headline.firstChild as Text, [createRect(20, 30, 120, 28)]);

    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null);

    const dispose = enableDatoVisualEditing({
      baseEditingUrl: 'https://acme.admin.datocms.com',
      overlays: 'hover',
      showBadge: false,
      openInNewTab: true,
      hoverLingerMs: 0
    });

    headline.dispatchEvent(new PointerEvent('pointerover', { bubbles: true, clientX: 40, clientY: 44, pointerType: 'mouse' }));
    await new Promise((resolve) => setTimeout(resolve, 0));
    headline.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, clientX: 40, clientY: 44 }));

    expect(openSpy).toHaveBeenCalledWith(
      'https://acme.admin.datocms.com/editor/item_types/article/items/query123/edit#fieldPath=title',
      '_blank',
      expect.stringContaining('noopener')
    );

    dispose();
  });

  it.each(['0', 'false', 'off'])('skips activation when the query toggle is %s', async (value) => {
    const payload = {
      cms: 'datocms',
      itemId: 'queryDisabled',
      itemTypeId: 'article',
      fieldPath: 'title'
    };
    const encoded = vercelStegaCombine('Disabled headline', payload);

    window.history.replaceState({}, '', `/blog?edit=${value}`);

    document.body.innerHTML = `<h1 id="headline">${encoded}</h1>`;
    const headline = document.getElementById('headline')!;
    headline.getBoundingClientRect = () => createRect(10, 10, 120, 30);
    textRectMap.set(headline.firstChild as Text, [createRect(10, 10, 120, 30)]);

    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null);

    const dispose = enableDatoVisualEditing({
      baseEditingUrl: 'https://acme.admin.datocms.com',
      overlays: 'hover',
      showBadge: false,
      openInNewTab: true,
      hoverLingerMs: 0
    });

    headline.dispatchEvent(new PointerEvent('pointerover', { bubbles: true, clientX: 30, clientY: 24, pointerType: 'mouse' }));
    headline.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, clientX: 30, clientY: 24 }));

    expect(openSpy).not.toHaveBeenCalled();
    expect(document.querySelector('[aria-live="polite"]')).toBeNull();

    dispose();
  });

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

  it('activates when the localStorage toggle is enabled', async () => {
    const payload = {
      cms: 'datocms',
      itemId: '789',
      itemTypeId: 'article',
      fieldPath: 'title'
    };
    const encoded = vercelStegaCombine('Local headline', payload);

    document.body.innerHTML = `<h1 id="headline">${encoded}</h1>`;
    const headline = document.getElementById('headline')!;
    headline.getBoundingClientRect = () => createRect(20, 30, 160, 40);
    textRectMap.set(headline.firstChild as Text, [createRect(20, 30, 160, 40)]);

    window.localStorage.setItem('datocms:ve', '1');

    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null);

    const dispose = enableDatoVisualEditing({
      baseEditingUrl: 'https://acme.admin.datocms.com',
      activate: 'localStorage',
      overlays: 'hover',
      showBadge: false,
      openInNewTab: true,
      hoverLingerMs: 0
    });

    headline.dispatchEvent(new PointerEvent('pointerover', { bubbles: true, clientX: 40, clientY: 40 }));
    await new Promise((resolve) => setTimeout(resolve, 0));
    headline.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, clientX: 40, clientY: 40 }));

    expect(openSpy).toHaveBeenCalledWith(
      'https://acme.admin.datocms.com/editor/item_types/article/items/789/edit#fieldPath=title',
      '_blank',
      expect.stringContaining('noopener')
    );

    dispose();
  });

  it('skips activation when the localStorage toggle is disabled', async () => {
    const payload = {
      cms: 'datocms',
      itemId: '1011',
      itemTypeId: 'article',
      fieldPath: 'title'
    };
    const encoded = vercelStegaCombine('Disabled headline', payload);

    document.body.innerHTML = `<h2 id="headline">${encoded}</h2>`;
    const headline = document.getElementById('headline')!;
    headline.getBoundingClientRect = () => createRect(20, 30, 160, 40);
    textRectMap.set(headline.firstChild as Text, [createRect(20, 30, 160, 40)]);

    window.localStorage.setItem('datocms:ve', '0');

    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null);

    const dispose = enableDatoVisualEditing({
      baseEditingUrl: 'https://acme.admin.datocms.com',
      activate: 'localStorage',
      overlays: 'hover',
      showBadge: false,
      openInNewTab: true,
      hoverLingerMs: 0
    });

    headline.dispatchEvent(new PointerEvent('pointerover', { bubbles: true, clientX: 40, clientY: 40 }));
    headline.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, clientX: 40, clientY: 40 }));

    expect(openSpy).not.toHaveBeenCalled();
    expect(document.body.lastElementChild).toBe(headline);

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

    expect(openSpy).toHaveBeenCalledWith(editUrl, '_blank', expect.stringContaining('noopener'));

    dispose();
  });

  it('honours onBeforeOpen returning false without preventing the original event', async () => {
    const payload = {
      cms: 'datocms',
      itemId: 'onbefore',
      itemTypeId: 'article',
      fieldPath: 'title'
    };
    const encoded = vercelStegaCombine('Before open', payload);

    document.body.innerHTML = `<p id="content">${encoded}</p>`;
    const content = document.getElementById('content')!;
    content.getBoundingClientRect = () => createRect(10, 10, 120, 28);
    textRectMap.set(content.firstChild as Text, [createRect(10, 10, 120, 28)]);

    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null);
    const onBeforeOpen = vi.fn(() => false);

    const dispose = enableDatoVisualEditing({
      baseEditingUrl: 'https://acme.admin.datocms.com',
      activate: 'always',
      overlays: 'hover',
      showBadge: false,
      openInNewTab: true,
      hoverLingerMs: 0,
      onBeforeOpen
    });

    content.dispatchEvent(new PointerEvent('pointerover', { bubbles: true, clientX: 40, clientY: 24, pointerType: 'mouse' }));
    await new Promise((resolve) => setTimeout(resolve, 0));

    const clickEvent = new MouseEvent('click', { bubbles: true, cancelable: true, clientX: 40, clientY: 24 });
    const preventDefaultSpy = vi.spyOn(clickEvent, 'preventDefault');

    content.dispatchEvent(clickEvent);

    expect(onBeforeOpen).toHaveBeenCalledTimes(1);
    expect(onBeforeOpen).toHaveBeenCalledWith(
      'https://acme.admin.datocms.com/editor/item_types/article/items/onbefore/edit#fieldPath=title',
      expect.any(MouseEvent),
      expect.objectContaining({ itemId: 'onbefore', fieldPath: 'title' })
    );
    expect(openSpy).not.toHaveBeenCalled();
    expect(preventDefaultSpy).not.toHaveBeenCalled();

    dispose();
  });

  it('falls back to explicit editUrl when deep link construction fails', async () => {
    document.body.innerHTML = `
      <div id="wrapper" data-datocms-edit-target data-datocms-edit-url="https://other.example.com/editor/items/42">
        <span id="content">Explicit content</span>
      </div>
    `;

    const wrapper = document.getElementById('wrapper')!;
    const content = document.getElementById('content')!;

    wrapper.getBoundingClientRect = () => createRect(10, 10, 180, 60);
    content.getBoundingClientRect = () => createRect(20, 20, 160, 40);

    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null);

    const dispose = enableDatoVisualEditing({
      baseEditingUrl: 'https://acme.admin.datocms.com',
      activate: 'always',
      overlays: 'hover',
      showBadge: false,
      openInNewTab: true,
      hoverLingerMs: 0
    });

    wrapper.dispatchEvent(new PointerEvent('pointerover', { bubbles: true, clientX: 20, clientY: 20 }));
    await new Promise((resolve) => setTimeout(resolve, 0));
    wrapper.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, clientX: 20, clientY: 20 }));

    expect(openSpy).toHaveBeenCalledWith(
      'https://other.example.com/editor/items/42',
      '_blank',
      expect.stringContaining('noopener')
    );

    dispose();
  });

  it('enforces min hit size when provided as an object', async () => {
    const payload = {
      cms: 'datocms',
      itemId: 'minhit',
      itemTypeId: 'article',
      fieldPath: 'title'
    };
    const encoded = vercelStegaCombine('Hit area', payload);

    document.body.innerHTML = `<span id="content">${encoded}</span>`;
    const content = document.getElementById('content')!;
    content.getBoundingClientRect = () => createRect(100, 120, 12, 10);
    textRectMap.set(content.firstChild as Text, [createRect(100, 120, 12, 10)]);

    const dispose = enableDatoVisualEditing({
      baseEditingUrl: 'https://acme.admin.datocms.com',
      activate: 'always',
      overlays: 'hover',
      showBadge: false,
      openInNewTab: true,
      hoverLingerMs: 0,
      hitPadding: 0,
      minHitSize: { width: 44, height: 32 }
    });

    content.dispatchEvent(new PointerEvent('pointerover', { bubbles: true, clientX: 106, clientY: 125, pointerType: 'mouse' }));
    await new Promise((resolve) => setTimeout(resolve, 0));

    const overlayRoot = document.querySelector('div[aria-live="polite"]') as HTMLElement;
    expect(overlayRoot).toBeTruthy();
    expect(overlayRoot.style.width).toBe('44px');
    expect(overlayRoot.style.height).toBe('32px');

    dispose();
  });

  it('clears hover overlays immediately when hoverLingerMs is 0', async () => {
    const payload = {
      cms: 'datocms',
      itemId: '1213',
      itemTypeId: 'article',
      fieldPath: 'title'
    };
    const encoded = vercelStegaCombine('Hover linger', payload);

    document.body.innerHTML = `<p id="content">${encoded}</p>`;
    const content = document.getElementById('content')!;
    content.getBoundingClientRect = () => createRect(10, 10, 120, 24);
    textRectMap.set(content.firstChild as Text, [createRect(10, 10, 120, 24)]);

    const dispose = enableDatoVisualEditing({
      baseEditingUrl: 'https://acme.admin.datocms.com',
      activate: 'always',
      overlays: 'hover',
      showBadge: false,
      openInNewTab: true,
      hoverLingerMs: 0
    });

    content.dispatchEvent(new PointerEvent('pointerover', { bubbles: true, clientX: 20, clientY: 20 }));
    await new Promise((resolve) => setTimeout(resolve, 0));

    const overlayRoot = document.body.lastElementChild as HTMLElement;
    expect(overlayRoot.style.display).toBe('block');

    content.dispatchEvent(
      new PointerEvent('pointermove', { bubbles: true, clientX: 9999, clientY: 9999, pointerType: 'mouse' })
    );

    expect(overlayRoot.style.display).toBe('none');

    dispose();
  });

  it('applies custom badge label and hides overlay segments from assistive tech', async () => {
    const payload = {
      cms: 'datocms',
      itemId: 'badge123',
      itemTypeId: 'article',
      fieldPath: 'title'
    };
    const encoded = vercelStegaCombine('Label test', payload);

    document.body.innerHTML = `<p id="content">${encoded}</p>`;
    const content = document.getElementById('content')!;
    content.getBoundingClientRect = () => createRect(50, 60, 90, 24);
    textRectMap.set(content.firstChild as Text, [createRect(50, 60, 90, 24)]);

    const dispose = enableDatoVisualEditing({
      baseEditingUrl: 'https://acme.admin.datocms.com',
      activate: 'always',
      overlays: 'hover',
      showBadge: true,
      badgeLabel: 'Apri in DatoCMS',
      openInNewTab: true,
      hoverLingerMs: 0
    });

    content.dispatchEvent(new PointerEvent('pointerover', { bubbles: true, clientX: 70, clientY: 72, pointerType: 'mouse' }));
    await new Promise((resolve) => setTimeout(resolve, 0));

    const overlayRoot = document.querySelector('div[aria-live="polite"]') as HTMLElement;
    expect(overlayRoot).toBeTruthy();

    const badge = overlayRoot.querySelector('button');
    expect(badge).toBeTruthy();
    expect(badge?.getAttribute('aria-label')).toBe('Apri in DatoCMS');
    expect(badge?.textContent).toBe('Apri in DatoCMS');

    const segments = overlayRoot.querySelectorAll('[role="presentation"]');
    expect(segments.length).toBeGreaterThan(0);
    segments.forEach((segment) => {
      expect(segment.getAttribute('aria-hidden')).toBe('true');
    });

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
      expect.stringContaining('noopener')
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
