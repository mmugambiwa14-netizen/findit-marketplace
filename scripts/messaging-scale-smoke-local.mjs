import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {
  createSmokeUser,
  root,
  smokeTarget,
  success,
} from './lib/tour-smoke-fixtures.mjs';
import { clearMessageBudgets, openSmokeDatabase } from './lib/postgres-smoke-fixtures.mjs';

let buyer;
let seller;
let stranger;
const listingIds = [];
const database = openSmokeDatabase(smokeTarget);

async function insertHistoricalMessages(rows, label) {
  let offset = 0;
  while (offset < rows.length) {
    const senderCounts = new Map();
    const batch = [];
    while (offset < rows.length) {
      const row = rows[offset];
      const count = senderCounts.get(row.sender_id) ?? 0;
      if (count >= 10) break;
      senderCounts.set(row.sender_id, count + 1);
      batch.push(row);
      offset += 1;
    }
    success(await root.from('inquiries').insert(batch), `${label} batch`);
    await clearMessageBudgets(database, [...senderCounts.keys()]);
  }
}

try {
  buyer = await createSmokeUser('message-scale-buyer');
  seller = await createSmokeUser('message-scale-seller');
  stranger = await createSmokeUser('message-scale-stranger');

  const conversationCount = Math.min(200, Math.max(65, Number(process.env.FINDIT_MESSAGE_SCALE_CONVERSATIONS) || 75));
  const listingRows = Array.from({ length: conversationCount }, (_, index) => ({
    kind: 'car',
    seller_id: seller.userId,
    seller_name: 'Message scale seller',
    title: index === 3 ? 'Literal %_ inbox vehicle' : `Message cursor vehicle ${String(index + 1).padStart(3, '0')}`,
    category: 'cars_sale',
    listing_type: 'sale',
    price: 10000 + index,
    currency: 'USD',
    status: 'available',
  }));
  const insertedListings = success(await root.from('listings').insert(listingRows).select('id,title'), 'create messaging scale listings');
  listingIds.push(...insertedListings.map((row) => row.id));

  const baseTime = Date.parse('2026-07-27T12:00:00Z');
  const conversationRows = insertedListings.map((listing, index) => {
    const createdAt = new Date(baseTime - Math.floor(index / 3) * 60_000).toISOString();
    return {
      id: crypto.randomUUID(),
      listing_id: listing.id,
      buyer_id: buyer.userId,
      seller_id: seller.userId,
      last_message_at: createdAt,
      last_message_sender_id: buyer.userId,
      created_at: createdAt,
      updated_at: createdAt,
    };
  });
  const conversations = success(await root.from('conversations').insert(conversationRows).select('id,listing_id,last_message_at'), 'create messaging scale conversations');

  const listingById = new Map(insertedListings.map((row) => [row.id, row]));
  const initialMessages = conversations.map((conversation, index) => ({
    id: crypto.randomUUID(),
    listing_id: conversation.listing_id,
    listing_title: listingById.get(conversation.listing_id)?.title,
    seller_id: seller.userId,
    buyer_id: buyer.userId,
    buyer_name: 'Message scale buyer',
    message: `Initial scale message ${index + 1}`,
    sender_id: buyer.userId,
    conversation_id: conversation.id,
    status: 'new',
    attachments: [],
    created_at: conversation.last_message_at,
  }));
  await insertHistoricalMessages(initialMessages, 'create messaging scale initial messages');

  const seenConversationIds = [];
  let inboxCursor = null;
  let inboxPages = 0;
  do {
    const rows = success(await buyer.browser.rpc('message_inbox_page', {
      p_query: '',
      p_unread_only: false,
      p_cursor_at: inboxCursor?.at ?? null,
      p_cursor_id: inboxCursor?.id ?? null,
      p_limit: 30,
    }), `load inbox keyset page ${inboxPages + 1}`);
    const hasMore = rows.length > 30;
    const page = rows.slice(0, 30);
    assert.ok(page.length > 0 && page.length <= 30, 'inbox pages remain bounded');
    seenConversationIds.push(...page.map((row) => row.conversation_id));
    const last = hasMore ? page.at(-1) : null;
    inboxCursor = last ? { at: last.last_message_at, id: last.conversation_id } : null;
    inboxPages += 1;
    assert.ok(inboxPages <= 20, 'inbox keyset traversal terminates');
  } while (inboxCursor);

  assert.equal(seenConversationIds.length, conversationCount, 'all inbox conversations are traversed');
  assert.equal(new Set(seenConversationIds).size, conversationCount, 'inbox keyset pages contain no duplicates');
  assert.ok(inboxPages >= 3, 'inbox traversal crosses several pages');

  const literal = success(await buyer.browser.rpc('message_inbox_page', {
    p_query: '%_', p_unread_only: false, p_cursor_at: null, p_cursor_id: null, p_limit: 30,
  }), 'search literal wildcard inbox title');
  assert.deepEqual(literal.map((row) => row.listing_title), ['Literal %_ inbox vehicle'], 'inbox treats wildcard characters literally');

  const primary = conversations[0];
  const extraThreadCount = Math.min(300, Math.max(120, Number(process.env.FINDIT_MESSAGE_SCALE_THREAD_MESSAGES) || 125));
  const extraMessages = Array.from({ length: extraThreadCount }, (_, index) => ({
    id: crypto.randomUUID(),
    listing_id: primary.listing_id,
    listing_title: listingById.get(primary.listing_id)?.title,
    seller_id: seller.userId,
    buyer_id: buyer.userId,
    buyer_name: 'Message scale buyer',
    message: `Thread scale message ${String(index + 1).padStart(3, '0')}`,
    sender_id: index % 2 ? seller.userId : buyer.userId,
    conversation_id: primary.id,
    status: 'new',
    attachments: [],
    created_at: new Date(baseTime + (index + 1) * 1000).toISOString(),
  }));
  await insertHistoricalMessages(extraMessages, 'create deep message thread');

  const seenMessageIds = [];
  let threadCursor = null;
  let threadPages = 0;
  do {
    const rows = success(await buyer.browser.rpc('message_thread_page', {
      p_conversation_id: primary.id,
      p_before_created_at: threadCursor?.at ?? null,
      p_before_id: threadCursor?.id ?? null,
      p_limit: 40,
    }), `load thread keyset page ${threadPages + 1}`);
    const hasMore = rows.length > 40;
    const page = rows.slice(0, 40);
    assert.ok(page.length > 0 && page.length <= 40, 'thread pages remain bounded');
    seenMessageIds.push(...page.map((row) => row.message_id));
    const oldest = hasMore ? page.at(-1) : null;
    threadCursor = oldest ? { at: oldest.created_at, id: oldest.message_id } : null;
    threadPages += 1;
    assert.ok(threadPages <= 20, 'thread keyset traversal terminates');
  } while (threadCursor);

  assert.equal(seenMessageIds.length, extraThreadCount + 1, 'all thread messages are traversed');
  assert.equal(new Set(seenMessageIds).size, extraThreadCount + 1, 'thread keyset pages contain no duplicates');
  assert.ok(threadPages >= 4, 'deep thread crosses several bounded pages');

  const strangerThread = await stranger.browser.rpc('message_thread_page', {
    p_conversation_id: primary.id,
    p_before_created_at: null,
    p_before_id: null,
    p_limit: 20,
  });
  assert.ok(strangerThread.error, 'non-participants cannot page a thread');

  console.log(`Messaging ${smokeTarget.label} scale smoke passed: ${conversationCount} inbox rows across ${inboxPages} pages and ${extraThreadCount + 1} thread messages across ${threadPages} pages, with no duplicates or skips.`);
} finally {
  const senderIds = [buyer?.userId, seller?.userId].filter(Boolean);
  if (senderIds.length) await clearMessageBudgets(database, senderIds, ['message.minute', 'message.day']);
  if (listingIds.length) await root.from('listings').delete().in('id', listingIds);
  for (const user of [buyer, seller, stranger].filter(Boolean)) {
    try { await user.browser.auth.signOut(); } catch { /* best effort */ }
    try { await root.auth.admin.deleteUser(user.userId); } catch { /* best effort */ }
  }
  await database.end({ timeout: 5 });
}
