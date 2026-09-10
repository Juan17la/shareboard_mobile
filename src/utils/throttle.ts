/**
 * Trailing throttle: invokes `fn` at most once per `waitMs`, always firing a
 * final call with the latest arguments. Used for cursor broadcasts and the
 * op-outbox flush.
 */
export function throttle<A extends unknown[]>(
  fn: (...args: A) => void,
  waitMs: number,
): { (...args: A): void; flush: () => void; cancel: () => void } {
  let last = 0;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let pending: A | null = null;

  const run = () => {
    last = Date.now();
    timer = null;
    if (pending) {
      const args = pending;
      pending = null;
      fn(...args);
    }
  };

  const throttled = (...args: A) => {
    pending = args;
    const remaining = waitMs - (Date.now() - last);
    if (remaining <= 0) {
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
      run();
    } else if (!timer) {
      timer = setTimeout(run, remaining);
    }
  };

  throttled.flush = () => {
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
    run();
  };
  throttled.cancel = () => {
    if (timer) clearTimeout(timer);
    timer = null;
    pending = null;
  };

  return throttled;
}
