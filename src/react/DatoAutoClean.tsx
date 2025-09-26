import {
  createElement,
  useRef,
  type ComponentPropsWithoutRef,
  type ElementRef,
  type JSX,
  type ReactNode,
  type Ref,
  type RefObject
} from 'react';
import { AUTO_CLEAN_ATTR } from '../utils/attr.js';
import type { AutoCleanOptions } from '../dom/autoClean.js';
import { useDatoAutoClean } from './useDatoAutoClean.js';

type ElementTag = keyof JSX.IntrinsicElements;

type DatoAutoCleanProps<E extends ElementTag = 'span'> = {
  as?: E;
  options?: AutoCleanOptions;
  children?: ReactNode;
} & Omit<ComponentPropsWithoutRef<E>, 'ref'>;

export function DatoAutoClean<E extends ElementTag = 'span'>(
  props: DatoAutoCleanProps<E>
): JSX.Element {
  const { as, options, children, ...rest } = props;
  const Component = (as ?? 'span') as ElementTag;
  type ComponentProps = ComponentPropsWithoutRef<E> & {
    ref?: Ref<unknown>;
  };

  const ref = useRef<ElementRef<E>>(null);
  useDatoAutoClean(ref as RefObject<Element>, options);

  const autoCleanProps = AUTO_CLEAN_ATTR in rest ? {} : { [AUTO_CLEAN_ATTR]: '' };

  const componentProps = {
    ...rest,
    ...autoCleanProps,
    ref
  } as ComponentProps;

  return createElement(Component, componentProps, children);
}
