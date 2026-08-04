import { useEffect } from 'react';

const THREAD_SELECTOR = 'main.findit-scroll-region';

function scrollToLatest(container) {
  requestAnimationFrame(() => {
    container.scrollTop = container.scrollHeight;
    requestAnimationFrame(() => {
      container.scrollTop = container.scrollHeight;
    });
  });
}

export default function ActiveConversationAutoScroll() {
  useEffect(() => {
    let observer;
    let retryTimer;
    let previousLastMessage;

    const attach = () => {
      const container = document.querySelector(THREAD_SELECTOR);
      const messageList = container?.firstElementChild;

      if (!container || !messageList) {
        retryTimer = window.setTimeout(attach, 50);
        return;
      }

      previousLastMessage = messageList.lastElementChild;
      scrollToLatest(container);

      observer = new MutationObserver(() => {
        const nextLastMessage = messageList.lastElementChild;
        if (!nextLastMessage || nextLastMessage === previousLastMessage) return;

        previousLastMessage = nextLastMessage;
        scrollToLatest(container);
      });

      observer.observe(messageList, { childList: true });
    };

    attach();

    return () => {
      if (retryTimer) window.clearTimeout(retryTimer);
      observer?.disconnect();
    };
  }, []);

  return null;
}
