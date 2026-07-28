import {
  findMessageConversation,
  findMessageInbox,
  findMessageInboxPage,
  findMessageThread,
  findMessageThreadPage,
  insertConversationMessage,
  insertConversationReport,
  startConversationRow,
  updateConversationBlock,
  updateConversationSeen,
} from '@/repositories/messagingRepository';
import {
  normalizeConversationBlock,
  normalizeConversationReport,
  normalizeMessageBody,
  normalizeMessageInboxPageRequest,
  normalizeMessageInboxRequest,
  normalizeMessageThreadPageRequest,
  normalizeMessagingId,
} from '@/services/messagingContracts';
import { resolveListingImages } from '@/services/listingCreationService';


async function hydrateConversationListing(value) {
  if (!value) return value;
  const [listingPhoto = null] = await resolveListingImages(value.listing_photo ? [value.listing_photo] : []);
  return {
    ...value,
    listing_photo: listingPhoto,
    listing_price: value.listing_price == null ? null : Number(value.listing_price),
    tour_duration_seconds: value.tour_duration_seconds == null ? null : Number(value.tour_duration_seconds),
  };
}

export async function startListingConversation(listingId, message) {
  return await startConversationRow(
    normalizeMessagingId(listingId, 'Listing'),
    normalizeMessageBody(message),
  );
}

export async function getMessageInbox(input) {
  const request = normalizeMessageInboxRequest(input);
  const rows = await findMessageInbox(request);
  return {
    items: await Promise.all((rows ?? []).map(hydrateConversationListing)),
    total: Number(rows?.[0]?.total_count ?? 0),
    limit: request.limit,
    offset: request.offset,
  };
}

export async function getMessageConversation(conversationId) {
  const id = normalizeMessagingId(conversationId);
  const [conversation, messages] = await Promise.all([
    findMessageConversation(id),
    findMessageThread(id),
  ]);
  if (!conversation) return null;
  return { conversation: await hydrateConversationListing(conversation), messages: messages ?? [] };
}

export async function sendConversationMessage(conversationId, message) {
  return await insertConversationMessage(
    normalizeMessagingId(conversationId),
    normalizeMessageBody(message),
  );
}

export async function markConversationSeen(conversationId) {
  return await updateConversationSeen(normalizeMessagingId(conversationId));
}

export async function setConversationBlocked(input) {
  return await updateConversationBlock(normalizeConversationBlock(input));
}

export async function reportMessageConversation(input) {
  return await insertConversationReport(normalizeConversationReport(input));
}


export async function getMessageInboxPage(input = {}) {
  const request = normalizeMessageInboxPageRequest(input);
  const rows = await findMessageInboxPage(request);
  const values = Array.isArray(rows) ? rows : [];
  const hasMore = values.length > request.limit;
  const pageRows = values.slice(0, request.limit);
  const last = hasMore ? pageRows.at(-1) : null;
  return {
    items: await Promise.all(pageRows.map(hydrateConversationListing)),
    nextCursor: last ? { at: last.last_message_at, id: last.conversation_id } : null,
  };
}

export async function getMessageConversationMetadata(conversationId) {
  const id = normalizeMessagingId(conversationId);
  const conversation = await findMessageConversation(id);
  return conversation ? await hydrateConversationListing(conversation) : null;
}

export async function getMessageThreadPage(conversationId, input = {}) {
  const request = normalizeMessageThreadPageRequest(conversationId, input);
  const rows = await findMessageThreadPage(request);
  const values = Array.isArray(rows) ? rows : [];
  const hasMore = values.length > request.limit;
  const pageRows = values.slice(0, request.limit);
  const oldest = hasMore ? pageRows.at(-1) : null;
  return {
    items: pageRows.slice().reverse(),
    nextCursor: oldest ? { at: oldest.created_at, id: oldest.message_id } : null,
  };
}
