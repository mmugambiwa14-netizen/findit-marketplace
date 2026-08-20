import {
  findMessageConversation,
  findMessageInboxPage,
  findMessageThread,
  findMessageThreadPage,
  findMessageUnreadCount,
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
  normalizeMessageThreadPageRequest,
  normalizeMessagingId,
} from '@/services/messagingContracts';
import { hydrateListingCardImages } from '@/services/listingCreationService';

function throwIfAborted(signal) {
  if (!signal?.aborted) return;
  if (typeof signal.throwIfAborted === 'function') signal.throwIfAborted();
  const failure = new Error('Messaging request was cancelled');
  failure.name = 'AbortError';
  throw failure;
}

function normalizeConversationNumbers(value, listingPhoto = null) {
  return {
    ...value,
    listing_photo: listingPhoto,
    listing_price: value.listing_price == null ? null : Number(value.listing_price),
    tour_duration_seconds: value.tour_duration_seconds == null ? null : Number(value.tour_duration_seconds),
  };
}

async function hydrateConversationListings(values, signal) {
  const rows = Array.isArray(values) ? values : [];
  if (!rows.length) return [];
  throwIfAborted(signal);

  const hydratedRows = await hydrateListingCardImages(rows.map((value) => ({
    ...value,
    photos: value?.listing_photo ? [value.listing_photo] : [],
  })));

  throwIfAborted(signal);
  return rows.map((value, index) => normalizeConversationNumbers(
    value,
    hydratedRows[index]?.photos?.[0] ?? null,
  ));
}

async function hydrateConversationListing(value, signal) {
  if (!value) return value;
  const [hydrated = null] = await hydrateConversationListings([value], signal);
  return hydrated;
}

export async function startListingConversation(listingId, message) {
  return await startConversationRow(
    normalizeMessagingId(listingId, 'Listing'),
    normalizeMessageBody(message),
  );
}

export async function getUnreadMessageCount(signal) {
  const value = await findMessageUnreadCount(signal);
  throwIfAborted(signal);
  return Math.max(0, Number(value) || 0);
}

export async function getMessageConversation(conversationId, signal) {
  const id = normalizeMessagingId(conversationId);
  const [conversation, messages] = await Promise.all([
    findMessageConversation(id, signal),
    findMessageThread(id, 200, signal),
  ]);
  throwIfAborted(signal);
  if (!conversation) return null;
  return { conversation: await hydrateConversationListing(conversation, signal), messages: messages ?? [] };
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

export async function getMessageInboxPage(input = {}, signal) {
  const request = normalizeMessageInboxPageRequest(input);
  const rows = await findMessageInboxPage(request, signal);
  throwIfAborted(signal);
  const values = Array.isArray(rows) ? rows : [];
  const hasMore = values.length > request.limit;
  const pageRows = values.slice(0, request.limit);
  const last = hasMore ? pageRows.at(-1) : null;
  return {
    items: await hydrateConversationListings(pageRows, signal),
    nextCursor: last ? { at: last.last_message_at, id: last.conversation_id } : null,
  };
}

export async function getMessageConversationMetadata(conversationId, signal) {
  const id = normalizeMessagingId(conversationId);
  const conversation = await findMessageConversation(id, signal);
  throwIfAborted(signal);
  return conversation ? await hydrateConversationListing(conversation, signal) : null;
}

export async function getMessageThreadPage(conversationId, input = {}, signal) {
  const request = normalizeMessageThreadPageRequest(conversationId, input);
  const rows = await findMessageThreadPage(request, signal);
  throwIfAborted(signal);
  const values = Array.isArray(rows) ? rows : [];
  const hasMore = values.length > request.limit;
  const pageRows = values.slice(0, request.limit);
  const oldest = hasMore ? pageRows.at(-1) : null;
  return {
    items: pageRows.slice().reverse(),
    nextCursor: oldest ? { at: oldest.created_at, id: oldest.message_id } : null,
  };
}
