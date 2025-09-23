export type TargetAttribute = 'data-datocms-edit-target' | 'data-vercel-edit-target';

const TARGET_ATTRS: TargetAttribute[] = ['data-datocms-edit-target', 'data-vercel-edit-target'];

export function resolveHighlightContainer(element: Element, preferred: TargetAttribute): Element {
  const attributes = preferred === 'data-vercel-edit-target'
    ? ['data-vercel-edit-target', 'data-datocms-edit-target']
    : ['data-datocms-edit-target', 'data-vercel-edit-target'];

  for (const attr of attributes) {
    const container = element.closest(`[${attr}]`);
    if (container) {
      return container;
    }
  }

  return element;
}

export function hasDatoTarget(element: Element): boolean {
  return TARGET_ATTRS.some((attr) => element.hasAttribute(attr));
}
