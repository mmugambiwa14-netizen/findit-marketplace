import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import ConversationThread from '@/components/messaging/ConversationThread';
import { supabase } from '@/lib/supabaseClient';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const METADATA_REFRESH_MS = 15_000;

/**
 * Adds realtime message delivery to the established thread implementation.
 * ConversationThread keeps a bounded tail-polling fallback while Realtime is
 * unavailable and slows that backup once the channel is healthy. Older message
 * history is never invalidated by live delivery. Metadata is refreshed separately
 * so a remote block, closure, or listing-state change cannot remain stale.
 */
export default function RealtimeConversationThread(props) {
  const { conversationId, currentUser } = props;
  const queryClient = useQueryClient();
  const [realtimeConnected, setRealtimeConnected] = useState(false);

  useEffect(() => {
    setRealtimeConnected(false);
    if (!UUID_PATTERN.test(String(conversationId || '')) || !currentUser?.id) return undefined;

    let cancelled = false;
    const refreshMetadata = () => {
      if (cancelled) return;
      queryClient.invalidateQueries({
        queryKey: ['message-conversation-metadata', conversationId],
        exact: true,
      });
      queryClient.invalidateQueries({ queryKey: ['message-inbox'] });
    };
    const refreshMessages = () => {
      if (cancelled) return;
      queryClient.invalidateQueries({
        queryKey: ['message-thread-tail', conversationId],
        exact: true,
      });
    };
    const refreshAll = () => {
      refreshMessages();
      refreshMetadata();
    };

    const channel = supabase
      .channel(`conversation:${conversationId}:${currentUser.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'inquiries',
          filter: `conversation_id=eq.${conversationId}`,
        },
        refreshAll,
      )
      .subscribe((status) => {
        if (cancelled) return;
        const subscribed = status === 'SUBSCRIBED';
        setRealtimeConnected(subscribed);
        if (subscribed) refreshAll();
      });

    const metadataInterval = window.setInterval(() => {
      if (document.visibilityState === 'visible') refreshMetadata();
    }, METADATA_REFRESH_MS);
    const refreshWhenVisible = () => {
      if (document.visibilityState === 'visible') refreshAll();
    };
    window.addEventListener('online', refreshAll);
    document.addEventListener('visibilitychange', refreshWhenVisible);

    return () => {
      cancelled = true;
      window.clearInterval(metadataInterval);
      window.removeEventListener('online', refreshAll);
      document.removeEventListener('visibilitychange', refreshWhenVisible);
      supabase.removeChannel(channel);
    };
  }, [conversationId, currentUser?.id, queryClient]);

  return <ConversationThread {...props} realtimeConnected={realtimeConnected} />;
}
