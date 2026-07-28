import { useCallback, useMemo, useState } from 'react';

export function useCursorStack() {
  const [stack, setStack] = useState([null]);
  const cursor = stack.at(-1) ?? null;
  const pageNumber = stack.length;

  const reset = useCallback(() => setStack([null]), []);
  const back = useCallback(() => setStack((current) => current.length > 1 ? current.slice(0, -1) : current), []);
  const forward = useCallback((nextCursor) => {
    if (!nextCursor) return;
    setStack((current) => [...current, nextCursor]);
  }, []);

  return useMemo(() => ({
    cursor,
    pageNumber,
    canGoBack: stack.length > 1,
    reset,
    back,
    forward,
  }), [back, cursor, forward, pageNumber, reset, stack.length]);
}
