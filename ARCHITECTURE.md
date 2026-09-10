# Architecture

## Overview

One Next.js app serves both the frontend and the backend: the browser never talks to Gemini
directly, and never sees the API key. Everything goes through a single API route, which
delegates all decision-making to one orchestrator composed of small, independently-testable
pieces.

```
┌─────────────────────────┐        POST /api/chat        ┌──────────────────────────────┐
│  Browser (Chat.tsx)      │ ────────────────────────────▶│  app/api/chat/route.ts       │
│  - message list          │  { message, history,         │  - validateChatRequest()     │
│  - input + Enter/Send    │    availabilityParams? }      │  - new ChatOrchestrator(...) │
│  - loading indicator     │                               │  - Response.json(...)        │
│  - clarify form          │◀──────────────────────────── │                              │
│  - availability cards    │   ChatApiResponse (§ below)   └──────────────┬───────────────┘
│  - error + retry         │                                              │
└─────────────────────────┘                                              ▼
                                                            ┌──────────────────────────────┐
                                                            │  ChatOrchestrator             │
                                                            │  (lib/chat-orchestrator.ts)   │
                                                            │  - routes on Intent           │
                                                            │  - builds ChatApiResponse     │
                                                            │  - logs {requestId, intent,   │
                                                            │    outcome}                   │
                                                            └───┬──────┬──────┬─────────────┘
                                                                │      │      │
                                        ┌───────────────────────┘      │      └───────────────────┐
                                        ▼                              ▼                          ▼
                          ┌──────────────────────┐     ┌──────────────────────┐    ┌──────────────────────┐
                          │ IntentClassifier      │     │ checkAvailability()   │    │ GeminiProvider        │
                          │ (keyword/regex,       │     │ (deterministic,       │    │ implements LlmProvider │
                          │  no LLM call)         │     │  seeded-hash mock)    │    │ (@google/genai)        │
                          └──────────────────────┘     └───────────┬───────────┘    └───────────┬───────────┘
                                                                    │                             │
                                                                    ▼                             ▼
                                                        ┌───────────────────────────────────────────┐
                                                        │            KnowledgeBase                    │
                                                        │  (lib/knowledge-base.ts, backed by           │
                                                        │   data/hotel-kb.json)                        │
                                                        │  getPolicies/getRooms/getAmenities/getFaqs/  │
                                                        │  getFullContextText()                        │
                                                        └───────────────────────────────────────────┘
```

## Request flow

1. **Frontend** (`components/Chat.tsx`) collects the guest's message plus the running
   `history`, and — when responding to a `clarify` prompt — structured `availabilityParams`
   from `AvailabilityForm`. It calls `lib/chat-client.ts`'s `sendChatMessage()`, which wraps
   `fetch('/api/chat')` with a 15s timeout.
2. **Route handler** (`app/api/chat/route.ts`) parses the JSON body, runs
   `validateChatRequest()` (message non-empty, history well-shaped), and on success constructs
   a `ChatOrchestrator` with a real `GeminiProvider`, then calls `.handle()`.
3. **ChatOrchestrator** (`lib/chat-orchestrator.ts`) is the only place request-level decisions
   get made:
   - Asks `IntentClassifier` whether this is an availability question or a knowledge question,
     and if availability, which of `checkIn`/`checkOut`/`adults` are present vs. missing.
   - **Availability, missing fields** → returns `type: 'clarify'` with `missing` and `partial`
     (already-known fields, so the frontend form doesn't re-ask for something the guest already
     said) — no LLM call at all.
   - **Availability, complete** → calls the deterministic `checkAvailability()` tool directly
     and returns `type: 'availability_result'` — no LLM call at all.
   - **Knowledge question** → builds a system prompt from `KnowledgeBase.getFullContextText()`,
     folds up to the last 6 turns of `history` into the prompt for follow-up context, and calls
     `GeminiProvider.generate()`. A `NOT_FOUND` sentinel from the model (instructed in the
     system prompt) is mapped to a friendly fallback reply rather than shown raw or treated as
     a hallucination risk.
   - Any thrown error from the LLM provider is caught and turned into a structured
     `type: 'error'` response (HTTP 500) — never an unhandled crash.
   - Every outcome is logged as one structured JSON line: `{requestId, intent, outcome, timestamp}`.
4. **Response** goes back to the frontend as one JSON object matching the `ChatApiResponse`
   contract below, which the frontend switches on by `.type` — never by parsing the reply text.

## The `ChatApiResponse` contract

Decided once, up front (before Step 3 of the build), specifically so "clean, structured API
responses that are easy for the frontend to consume" didn't mean a flat `{ reply: string }`
that the frontend would have to keep re-interpreting:

```ts
type ChatApiResponse = { requestId: string } & (
  | { type: 'answer'; reply: string }
  | { type: 'clarify'; reply: string; missing: ('checkIn'|'checkOut'|'adults')[]; partial: Partial<AvailabilityQuery> }
  | { type: 'availability_result'; reply: string; query: AvailabilityQuery; rooms: AvailabilityRoom[] }
  | { type: 'error'; reply: string; code: 'VALIDATION_ERROR' | 'LLM_ERROR' | 'INTERNAL_ERROR' }
);
```

`requestId` ties every response back to a server log line. `type` lets the frontend render
each case distinctly (plain bubble / inline form / result cards / error-with-retry) without
ever needing to guess from the reply text.

## Why this SOLID split

The assignment explicitly asks which parts should use AI and which should remain
deterministic — the module boundaries here exist to make that split enforceable in code, not
just in prose:

- **Single Responsibility** — `KnowledgeBase` only loads/queries data; `LlmProvider` only talks
  to the model; `AvailabilityTool` is pure deterministic logic; `IntentClassifier` only routes;
  `ChatOrchestrator` composes them and contains no business logic of its own.
- **Open/Closed** — adding a new tool (e.g. a future `checkCancellationEligibility`) means
  registering it in the orchestrator, not rewriting its internals.
- **Liskov Substitution** — `LlmProvider` is an interface; `GeminiProvider` implements it today,
  and a different provider could be swapped in without touching `ChatOrchestrator` or the route.
- **Interface Segregation** — `KnowledgeBase` exposes narrow methods (`getRooms()`,
  `getFaqs()`, ...) instead of one `getEverything()` blob.
- **Dependency Inversion** — `ChatOrchestrator` takes `LlmProvider`, `KnowledgeBase`,
  `IntentClassifier`, and the availability tool function as constructor arguments. This is what
  lets the test suite inject a fake `LlmProvider` and a spy availability tool without ever
  calling the real Gemini API (see `lib/chat-orchestrator.test.ts`), and is also what fixed a
  real bug during development: the route used to construct `GeminiProvider` eagerly for every
  request, which threw when no API key was set — even for availability requests that never
  touch the LLM. Making the key check lazy (only on `generate()`) fixed it; DI is what made
  that bug visible via a fast, no-network test rather than a production incident.

## Data flow summary

`data/hotel-kb.json` (static file) → `KnowledgeBase` (typed access) → either:
- `checkAvailability()` reads `getRooms()` for capacity/price, deterministic — no AI, no
  network call, or
- the system prompt reads `getFullContextText()`, sent to Gemini alongside the guest's message
  and recent history — the only place an external network call happens.

No database, no server-side session state: the frontend resends the full `history` on every
request (see `DECISIONS.md` for why this was the right tradeoff for this assignment's scope).
