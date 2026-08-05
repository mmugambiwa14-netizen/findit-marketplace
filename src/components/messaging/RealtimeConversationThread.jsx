import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import ConversationThread from '@/components/messaging/ConversationThread';
import { supabase } from '@/lib/supabaseClient';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Adds realtime message delivery to the established thread implementation.
 * Polling inside ConversationThread remains as a fallback for interrupted or
 * unsupported realtime connections.
 */
export default function RealtimeConversationThread(props) {
  const { conversationId, currentUser } = props;
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!UUID_PATTERN.test(String(conversationId || '')) || !currentUser?.id) return undefined;

    let cancelled = false;
    const refresh = () => {
      if (cancelled) return;
      queryClient.invalidateQueries({
        queryKey: ['message-thread', conversationId],
        exact: true,
      });
      queryClient.invalidateQueries({
        queryKey: ['message-conversation-metadata', conversationId],
        exact: true,
      });
      queryClient.invalidateQueries({ queryKey: ['message-inbox'] });
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
        refresh,
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') refresh();
      });

    const refreshWhenVisible = () => {
      if (document.visibilityState === 'visible') refresh();
    };
    window.addEventListener('online', refresh);
    document.addEventListener('visibilitychange', refreshWhenVisible);

    return () => {
      cancelled = true;
      window.removeEventListener('online', refresh);
      document.removeEventListener('visibilitychange', refreshWhenVisible);
      supabase.removeChannel(channel);
    };
  }, [conversationId, currentUser?.id, queryClient]);

  return <ConversationThread {...props} />;
}
