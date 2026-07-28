import { supabase } from '@/lib/supabaseClient';

function rpc(name, params, message) {
  return supabase.rpc(name, params).then(({ data, error }) => {
    if (error) {
      const failure = new Error(message);
      failure.cause = error;
      throw failure;
    }
    return data;
  });
}

export function startConversationRow(listingId, body) {
  return rpc('start_listing_conversation', {
    p_listing_id: listingId,
    p_message: body,
  }, 'Unable to start the conversation');
}

export function insertConversationMessage(conversationId, body) {
  return rpc('send_conversation_message', {
    p_conversation_id: conversationId,
    p_message: body,
  }, 'Unable to send the message');
}

export function findMessageInbox(request) {
  return rpc('message_inbox', {
    p_query: request.query,
    p_unread_only: request.unreadOnly,
    p_limit: request.limit,
    p_offset: request.offset,
  }, 'Unable to load messages');
}

export function findMessageConversation(conversationId) {
  return rpc('message_conversation', {
    p_conversation_id: conversationId,
  }, 'Unable to load the conversation');
}

export function findMessageThread(conversationId, limit = 200) {
  return rpc('message_thread_rows', {
    p_conversation_id: conversationId,
    p_limit: limit,
  }, 'Unable to load conversation messages');
}

export function updateConversationSeen(conversationId) {
  return rpc('mark_conversation_seen', {
    p_conversation_id: conversationId,
  }, 'Unable to update the unread state');
}

export function updateConversationBlock(input) {
  return rpc('set_conversation_block', {
    p_conversation_id: input.conversationId,
    p_blocked: input.blocked,
  }, 'Unable to update the conversation block');
}

export function insertConversationReport(input) {
  return rpc('report_conversation', {
    p_conversation_id: input.conversationId,
    p_reason: input.reason,
    p_description: input.description,
  }, 'Unable to report the conversation');
}

export function findMessageInboxPage(request) {
  return rpc('message_inbox_page', {
    p_query: request.query,
    p_unread_only: request.unreadOnly,
    p_cursor_at: request.cursor?.at ?? null,
    p_cursor_id: request.cursor?.id ?? null,
    p_limit: request.limit,
  }, 'Unable to load messages');
}

export function findMessageThreadPage(request) {
  return rpc('message_thread_page', {
    p_conversation_id: request.conversationId,
    p_before_created_at: request.cursor?.at ?? null,
    p_before_id: request.cursor?.id ?? null,
    p_limit: request.limit,
  }, 'Unable to load conversation messages');
}
