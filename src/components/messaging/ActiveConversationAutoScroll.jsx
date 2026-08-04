import { useEffect } from 'react';

const THREAD_SELECTOR = 'main.findit-scroll-region';
const ATTACH_RETRY_MS = 50;

function scrollToLatest(container) {
  requestAnimationFrame(() => {
    container.scrollTop = container.scrollHeight;
    requestAnimationFrame(() => {
      container.scrollTop = container.scrollHeight;
    });
  });
}

/**
 * Keeps an active conversation aligned to its newest rendered message.
 *
 * Incoming messages can update through query polling without replacing the
 * message-list element itself. Watch both DOM additions and list-size changes
 * so React renders, image expansion and delayed layout all end at the newest
 * message.
 */
export default function ActiveConversationAutoScroll() {
  useEffect(() => {
    let mutationObserver;
    let resizeObserver;
    let retryTimer;
    let container;
    let messageList;
    let previousHeight = 0;

    const followLatest = () => {
      if (!container) return;
      scrollToLatest(container);
    };

    const attach = () => {
      container = document.querySelector(THREAD_SELECTOR);
      messageList = container?.firstElementChild;

      if (!container || !messageList) {
        retryTimer = window.setTimeout(attach, ATTACH_RETRY_MS);
        return;
      }

      previousHeight = messageList.scrollHeight;
      followLatest();

      mutationObserver = new MutationObserver((records) => {
        const addedContent = records.some((record) => record.addedNodes.length > 0);
        if (addedContent) followLatest();
      });
      mutationObserver.observe(messageList, {
        childList: true,
        subtree: true,
      });

      if (typeof ResizeObserver !== 'undefined') {
        resizeObserver = new ResizeObserver(() => {
          const nextHeight = messageList.scrollHeight;
          if (nextHeight <= previousHeight) return;
          previousHeight = nextHeight;
          followLatest();
        });
        resizeObserver.observe(messageList);
      }
    };

    attach();

    return () => {
      if (retryTimer) window.clearTimeout(retryTimer);
      mutationObserver?.disconnect();
      resizeObserver?.disconnect();
    };
  }, []);

  return null;
}
