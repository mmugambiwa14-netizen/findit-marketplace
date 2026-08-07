# F-059 — seller-facing UI promised a Peek moderation step that does not exist

**Finding:** P2 · Tranche 1 · Root cause **RC-4** · **Discovered during WP-09**, not in the audit's 56
**Status:** **DONE** · `LOCAL-EXEC` **PASS**

---

## 1. Why this exists

The MVP removed human Peek moderation (`REMEDIATION-PROMPT.md` §2.3). A Response Peek publishes when
**processing succeeds**; safety is **report-driven after publication**.

The seller-facing UI never got the message. While classifying contract test `508` in WP-09, checking the
component instead of assuming the test was merely stale showed the moderation copy is **still shipped to
users**.

This is worse than stale vocabulary (F-052, admin-facing, Tranche 3). It is a **promise to a user about how
the product behaves**, and it is false. A seller uploads a Response Peek, is told it will be reviewed and
answered "only after approval", and then waits for an approval step that will never happen — while the Peek
has in fact already published. It makes correct behaviour look broken.

## 2. What was wrong

The audit's original note named two strings. Reading the surrounding components found **five, across two
files** — the extra three would have been missed by fixing only what was cited.

| Location | Was |
|---|---|
| `BuyerPeekRequestsQueue.jsx:193` | *"Response Peek uploaded. It will answer this request automatically **after approval**."* |
| `BuyerPeekRequestsQueue.jsx:260` | *"PeekaListing will attach the **approved** video to this request automatically."* |
| `BuyerPeekRequestsQueue.jsx:277` | *"The accepted request remains open while the video is uploaded, processed and **moderated**. It becomes answered **only after approval**."* |
| `ResponsePeekBindingQueue.jsx:52` | *"**Ready after moderation**"* |
| `ResponsePeekBindingQueue.jsx:54` | *"Choose which buyer requests each **approved** Peek answers."* |

## 3. What it says now

Each string now describes processing, which is what actually gates publication:

| Location | Now |
|---|---|
| `:193` | *"Response Peek uploaded. It will answer this request automatically once processing finishes."* |
| `:260` | *"PeekaListing attaches the video to this request automatically once it finishes processing."* |
| `:277` | *"The accepted request stays open while the video uploads and processes. It becomes answered automatically as soon as processing finishes."* |
| `ResponsePeekBindingQueue.jsx:52` | *"Ready to attach"* |
| `:54` | *"Choose which buyer requests each published Peek answers."* |

**Copy only.** No control flow, no state machine, no service call changed.

## 4. Proving test

Written during WP-09 and failing on purpose since then —
`tests/responsePeekUploadContracts.test.mjs`, contract `508`:

```js
for (const [name, source] of [['seller queue', queue], ['binding queue', binding]]) {
  assert.doesNotMatch(source, /moderat/i, `${name} must not promise a moderation step`);
  assert.doesNotMatch(source, /\bapprov/i, `${name} must not promise an approval step`);
}
```

Extended here to cover `ResponsePeekBindingQueue` too, since the fix reached a second component the original
finding did not name.

```
$ node --test ./tests/responsePeekUploadContracts.test.mjs
# tests 3   # pass 3   # fail 0
```

| Suite | Before | After |
|---|---|---|
| `node --test ./tests/*.test.mjs` | 769 · **11 fail** | 769 · **10 fail** |
| `node --test ./tests/security/*.test.mjs` | **41/41** | **41/41** |

Gates: `lint` 0 · `typecheck` 0 · `typecheck:active` 0 · `verify:hygiene` 0 · `verify:sql-boundary` 0.

## 5. Deliberately not changed

**`src/components/tours/TourProcessingState.jsx:66`** reads
`tour?.moderation_status === 'approved'`. That is **state logic, not a promise** — it inspects a database
column whose value the MVP sets automatically, and the copy it drives (*"Peek active"*, *"The Peek is ready
and follows the parent listing availability"*) contains no approval language and is accurate.

Removing the column read would change behaviour, not wording, and the column's default is **F-026's**
territory (WP-20 — the default is still the legacy `'pending'`, which is a genuine latent hazard). Renaming
the vocabulary itself is **F-052** (Tranche 3). Both stay where they are.

Admin-facing Peek vocabulary (`admin_tour_queue_page`, *"Peek moderation queue"*) is likewise untouched —
that is **F-052**, and Phase 16 already determined the underlying behaviour is correct report-driven,
post-publication safety.
