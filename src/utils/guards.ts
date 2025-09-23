export function isElement(target: EventTarget | null | undefined): target is Element {
  return !!target && target instanceof Element;
}

export function isHTMLElement(target: EventTarget | null | undefined): target is HTMLElement {
  return !!target && target instanceof HTMLElement;
}

export function isImageElement(target: EventTarget | null | undefined): target is HTMLImageElement {
  return !!target && target instanceof HTMLImageElement;
}
