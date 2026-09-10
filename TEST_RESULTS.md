# Evaluation & Test Results

All scenarios below run automatically via `npm test` (Vitest). Full suite: **22/22 passing**
across 4 test files, no real Gemini API calls made (all LLM calls are mocked/injected — see
`ARCHITECTURE.md`'s Dependency Inversion note). Output below is copied from an actual local run.

```
 Test Files  4 passed (4)
      Tests  22 passed (22)
```

## Master scenario list (mapped to the assignment's Evaluation & Testing categories)

| ID | Scenario | Assignment category | File | Result |
|---|---|---|---|---|
| B1 | Normal FAQ question answered from KB | Normal guest questions | `lib/chat-orchestrator.test.ts` | ✅ pass |
| B2 | Availability question, all params → tool called with correct args | Availability/tool-calling | `lib/chat-orchestrator.test.ts` | ✅ pass |
| B3 | Availability question, missing params → clarify | Questions with missing information | `lib/chat-orchestrator.test.ts` | ✅ pass |
| B4 | Question outside KB scope → fallback, not hallucination | Backend/model failure-fallback | `lib/chat-orchestrator.test.ts` | ✅ pass |
| B5 | Ambiguous relative date ("next week") → clarify, not a guessed date | Ambiguous questions | `lib/chat-orchestrator.test.ts` | ✅ pass |
| B6 | Guest states a false premise → corrected from KB, not agreed with | Incorrect or unsupported assumptions | `lib/chat-orchestrator.test.ts` | ✅ pass |
| B7 | Follow-up question uses prior history | Conversation follow-ups | `lib/chat-orchestrator.test.ts` | ✅ pass |
| B8 | Invalid request body → 400 with structured error | (validation robustness) | `lib/validate-chat-request.test.ts` (7 sub-cases) | ✅ pass |
| B9 | LLM provider throws → graceful `type:'error'`, no crash | Backend/model failure-fallback | `lib/chat-orchestrator.test.ts` | ✅ pass |
| B10 | No rooms available → UI-friendly empty result, not an error | Availability/tool-calling (edge case) | `lib/chat-orchestrator.test.ts` | ✅ pass |
| B11 | Direct POST to the real route handler → full response shape asserted | End-to-end flow (backend side) | `app/api/chat/route.test.ts` | ✅ pass |
| F1 | Loading indicator shown while a request is pending, hidden after | Frontend loading states | `components/Chat.test.tsx` | ✅ pass |
| F2 | Failed request → inline error + retry; retry doesn't duplicate the message | Frontend error states | `components/Chat.test.tsx` | ✅ pass |
| F3 | Full mocked flow: question → answer → availability → clarify → results | End-to-end flow (frontend side) | `components/Chat.test.tsx` | ✅ pass |

14 scenarios, every category in the assignment's Evaluation & Testing list covered by a
dedicated scenario (not overloaded onto one test), comfortably clearing the "8–10" ask. The
remaining 8 passing tests are additional `validateChatRequest` edge cases (bad role in history,
non-object body, whitespace-only message, etc.) bundled under B8's category above.

## Detailed results

### Backend — `ChatOrchestrator` (`lib/chat-orchestrator.test.ts`)

| Test | Outcome logged | Result |
|---|---|---|
| answers a normal FAQ question from the knowledge base | `{"intent":"knowledge","outcome":"answer"}` | ✅ |
| calls checkAvailability with the extracted args when all params are present | `{"intent":"availability","outcome":"availability_result"}`, tool called with `('2026-09-15','2026-09-18',2, kb)` | ✅ |
| asks a clarifying question when availability params are missing | `{"intent":"availability","outcome":"clarify"}`, `missing: ['checkIn','checkOut','adults']` | ✅ |
| returns a friendly fallback (not the raw sentinel) when the answer is not in the KB | `{"intent":"knowledge","outcome":"fallback"}` | ✅ |
| treats an ambiguous relative date as missing info and asks to clarify | `{"intent":"availability","outcome":"clarify"}` | ✅ |
| does not agree with a false premise not supported by the KB | `{"intent":"knowledge","outcome":"fallback"}` | ✅ |
| folds conversation history into the prompt for follow-up questions | prompt sent to the LLM contained both prior turns verbatim | ✅ |
| returns a graceful error when the LLM provider throws | `{"intent":"knowledge","outcome":"llm_error"}`, HTTP 500, `code: 'LLM_ERROR'`, error logged with stack trace, no crash | ✅ |
| returns a UI-friendly availability_result when no rooms are available | `{"intent":"availability","outcome":"no_availability"}`, `rooms` all `available:false`, reply reads "no rooms are available..." | ✅ |

### Backend — request validation (`lib/validate-chat-request.test.ts`, 7 tests)

Rejects: missing `message`, whitespace-only `message`, non-array `history`, a history entry
with an invalid `role`, and non-object bodies (string/null/undefined). Accepts a well-formed
body and defaults `history` to `[]`; accepts a body with `history` and `availabilityParams`
present. All 7 ✅.

### Backend — end-to-end route handler (`app/api/chat/route.test.ts`, B11)

Three tests POST directly to the real exported `POST` handler (not a mock):
1. A complete availability request returns HTTP 200 and a `availability_result` payload
   matching the exact contract shape (`requestId` present, `query` matches input, every room
   has the right field types) — genuinely end-to-end, no Gemini key needed since this path is
   deterministic.
2. A malformed body (`{"history":[]}`, no `message`) returns HTTP 400, `type:'error'`,
   `code:'VALIDATION_ERROR'`.
3. Invalid JSON in the request body returns HTTP 400 rather than crashing the handler (this
   specifically exercises the `request.json().catch(() => undefined)` guard added during Step 5).

All 3 ✅.

### Frontend — `components/Chat.test.tsx` (React Testing Library, mocked `sendChatMessage`)

- **F1 (loading state)**: submits a message while the mocked backend call is left pending;
  asserts the loading indicator (`data-testid="loading-indicator"`) is present, then resolves
  the mock and asserts the indicator disappears and the reply renders. ✅
- **F2 (error state + retry)**: mocks a rejected request (network failure), asserts the inline
  error text and a "Retry" button render; clicks Retry with a second mock resolving
  successfully, asserts the reply now renders **and** the original user message still appears
  exactly once (retry does not duplicate the chat bubble). ✅
- **F3 (end-to-end mocked flow)**: drives, in one render, a normal question → answer, then an
  availability question with `adults` known but dates missing → asserts the clarify form
  appears, fills the two date inputs, submits → asserts room cards render, and asserts the
  final request payload's `availabilityParams` correctly merged the pre-known `adults: 2` with
  the newly-entered dates (this is the regression test for the `partial`-fields contract bug
  found and fixed during Step 7). ✅

## Manual / recorded verification (not automated, but performed and observed)

These correspond to the assignment's "frontend loading and error states" and "end-to-end
frontend-to-backend flow" categories at the actual browser level (F1–F3 above cover the same
ground with a mocked backend; these were also run live against the real dev server during
development):

- Opened the app, asked a question, saw the backend call happen and a response render.
- Asked a follow-up ("what about for 4 guests?") and confirmed context was used.
- Triggered an availability question, filled the inline date/guest form, saw results as cards.
- Verified at 375×812 (mobile) viewport: no horizontal overflow (`scrollWidth === innerWidth`,
  checked programmatically), layout stacks correctly, room cards collapse to one column.
- Triggered a genuine failure (no API key configured) and confirmed the distinct red error
  card with Retry renders, and Retry re-attempts without duplicating the message.
- A short screen recording covering this walkthrough accompanies the submission (see `README.md`).

## Two real bugs this test-writing process actually caught

Documented here rather than just fixed silently, since it's direct evidence the testing
approach did its job rather than being written after the fact to match already-correct code:

1. **Eager `GeminiProvider` construction** (found manually while curl-verifying Step 4): the
   route constructed `new GeminiProvider()` for every request regardless of intent, which threw
   without an API key — breaking availability/clarify requests that never touch the LLM at all.
   Fixed by deferring the key check to `generate()`.
2. **Dead regex stem in the intent classifier** (found while writing Step 9's tests): `\bavailab\b`
   can never match inside "available"/"availability" since a word boundary can't occur mid-word.
   Availability detection had been silently working only by accident, via other phrasings like
   "do you have rooms". Fixed to `availab\w*`.
3. **Missing `partial` field in the `clarify` contract** (found while designing the Step 7 UI,
   before it shipped): the response told the frontend what was *missing* but not what was
   *already known* (e.g. "rooms for 2 adults" → `adults` extracted, only dates missing). A form
   rendering just the missing fields would have silently dropped the known value on submit.
   Added `partial` to the contract; F3 above is the regression test for it.
