import { useEffect, useRef } from 'react';
import { useLocation, useSearchParams } from 'react-router-dom';

const MAX_WAIT_MS = 8000;

function findPeekThreadsSection() {
  return document.querySelector('section[aria-labelledby^="peek-threads-"]');
}

function findRequestButton(section) {
  return [...section.querySelectorAll('button')].find((button) => (
    button.textContent?.trim().toLowerCase().includes('request a peek')
  ));
}

export default function PeekRequestIntentHandler() {
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const handledLocationRef = useRef('');
  const hasRequestIntent = searchParams.get('requestPeek') === '1';
  const locationKey = `${location.pathname}${location.search}`;

  useEffect(() => {
    if (!hasRequestIntent || handledLocationRef.current === locationKey) return undefined;

    let completed = false;
    let observer;
    const startedAt = Date.now();

    const clearIntent = () => {
      const next = new URLSearchParams(searchParams);
      next.delete('requestPeek');
      setSearchParams(next, { replace: true });
    };

    const activate = () => {
      if (completed) return true;
      const section = findPeekThreadsSection();
      if (!section) return false;

      completed = true;
      handledLocationRef.current = locationKey;
      section.scrollIntoView({ behavior: 'smooth', block: 'start' });

      const requestButton = findRequestButton(section);
      if (requestButton && !requestButton.disabled) {
        window.setTimeout(() => requestButton.click(), 280);
      }
      clearIntent();
      observer?.disconnect();
      return true;
    };

    if (activate()) return undefined;

    observer = new MutationObserver(() => {
      if (activate() || Date.now() - startedAt >= MAX_WAIT_MS) observer.disconnect();
    });
    observer.observe(document.body, { childList: true, subtree: true });

    const timeout = window.setTimeout(() => {
      observer?.disconnect();
      if (!completed) clearIntent();
    }, MAX_WAIT_MS);

    return () => {
      observer?.disconnect();
      window.clearTimeout(timeout);
    };
  }, [hasRequestIntent, locationKey, searchParams, setSearchParams]);

  return null;
}
