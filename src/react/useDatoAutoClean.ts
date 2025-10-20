/** React hook wrapper around the auto-clean utility. */
import { useEffect, type RefObject } from 'react';
import { autoCleanStegaWithin } from '../dom/autoClean.js';
import type { AutoCleanOptions } from '../dom/autoClean.js';

export type UseDatoAutoCleanOptions = AutoCleanOptions;

/**
 * React hook that runs {@link autoCleanStegaWithin} on the element referenced by `ref`.
 */
export function useDatoAutoClean<T extends Element>(
  ref: RefObject<T | null>,
  options?: UseDatoAutoCleanOptions
): void {
  const delayMs = options?.delayMs;
  const observe = options?.observe;
  const cleanImageAlts = options?.cleanImageAlts;
  const observeImageAlts = options?.observeImageAlts;
  const skipSelectors = options?.skipSelectors;
  const skipKey = skipSelectors?.length ? skipSelectors.join('|') : '';

  useEffect(() => {
    const element = ref.current;
    if (!element) {
      return;
    }
    return autoCleanStegaWithin(element, {
      delayMs,
      observe,
      cleanImageAlts,
      observeImageAlts,
      skipSelectors
    });
  }, [ref, delayMs, observe, cleanImageAlts, observeImageAlts, skipKey]);
}
