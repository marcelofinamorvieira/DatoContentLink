export type ThrottledFn<T extends (...args: never[]) => void> = ((...args: Parameters<T>) => void) & {
  cancel: () => void;
};

export function rafThrottle<T extends (...args: never[]) => void>(fn: T): ThrottledFn<T> {
  let frame: number | null = null;
  let lastArgs: Parameters<T> | null = null;

  const invoke = () => {
    frame = null;
    if (lastArgs) {
      fn(...lastArgs);
      lastArgs = null;
    }
  };

  const throttled = ((...args: Parameters<T>) => {
    lastArgs = args;
    if (frame == null) {
      frame = window.requestAnimationFrame(invoke);
    }
  }) as ThrottledFn<T>;

  throttled.cancel = () => {
    if (frame != null) {
      window.cancelAnimationFrame(frame);
      frame = null;
    }
    lastArgs = null;
  };

  return throttled;
}
