# Product, UX, Engineering & AI Decisions

## What customer problem are you solving?

Two problems at once, for two different people. For the **guest**: getting a quick, correct
answer to a routine question ("is breakfast included?", "can I bring 4 people?") or checking
room availability, without waiting for the front desk or hunting through a static FAQ page.
For the **hotel**: deflecting repetitive, low-value questions away from front-desk staff so
they can spend time on things that actually need a human (a walk-in complaint, a special
request), while making sure the guest-facing surface never confidently states something false
about the property.

## What does the guest journey look like?

1. Guest lands on the page and sees an open chat with a one-line prompt of what it can help
   with (rather than a blank box — reduces "what am I supposed to ask this thing" hesitation).
2. Guest asks a normal question → sees a loading indicator → gets a grounded answer.
3. Guest asks a follow-up ("what about for 4 guests?") → the assistant uses the prior turn's
   context, no need to re-state the whole question.
4. Guest asks an availability question → if info is missing, a **date/guest-count form**
   appears inline (not a request to type dates in free text, which is error-prone and slow on
   mobile) → guest fills it → sees room results as clear cards (type, capacity, price,
   available/not).
5. If anything fails (network, timeout, model error), the guest sees a plain-language error
   with a **Retry** button — never a silent hang or a raw stack trace.

## Why did you design the frontend experience the way you did?

- **Chat as the single interface**, rather than a chat box plus a separate "check availability"
  page/form, because the assignment's own example questions mix property FAQs and availability
  in the same breath — splitting them into two UI surfaces would force the guest to decide
  which tool to use before they've even framed their question.
- **Structured input for dates/guests instead of free text**, because parsing "next Tuesday for
  a few days" reliably is exactly the kind of ambiguity an LLM would have to guess at — pulling
  it into a native date picker turns an AI-parsing problem into a solved, deterministic UI
  problem. The assistant still accepts dates typed in the message (`YYYY-MM-DD`) when a guest
  volunteers them, but never *requires* free-text parsing to succeed.
- **The response contract (`type: 'answer' | 'clarify' | 'availability_result' | 'error'`)
  drives the UI directly** rather than the frontend trying to detect "is this response asking me
  for something?" from reply text — see `ARCHITECTURE.md`. This was a deliberate contract-first
  decision made before any UI was built, specifically to avoid the frontend having to
  reverse-engineer backend intent from prose.
- **Errors are visually distinct from answers.** A `NOT_FOUND`-derived fallback ("I don't have
  that information...") is still a successful `type: 'answer'` and renders as a normal bubble —
  it's a legitimate, honest response. A `type: 'error'` (backend/model failure) gets a separate
  red card with Retry, because those are two different situations for the guest: one is "the
  hotel doesn't have that information," the other is "something is broken, try again."

## Which parts should use AI and which parts should remain deterministic?

**Deterministic, no LLM involved at all:**
- Detecting an availability question and extracting `checkIn`/`checkOut`/`adults` (keyword and
  regex based — the assignment explicitly notes this doesn't need an LLM call).
- `checkAvailability()` itself — a mock but fully deterministic function; a real version would
  hit a PMS/booking system, and that must never be something an LLM "decides" the outcome of.
- Request validation, HTTP status codes, logging.

**AI (Gemini), and only AI:**
- Answering open-ended property/amenity/policy/FAQ questions grounded in the knowledge base
  text — this is the one part of the problem that's genuinely natural-language-shaped (guests
  phrase the same question a hundred different ways) and where hard-coding every phrasing isn't
  feasible.

The dividing line is simple: **anything with a business-correctness requirement (would a wrong
answer cost the hotel money or trust?) stays deterministic; anything that's fundamentally about
understanding varied phrasing of a question already answerable from fixed data goes to the
LLM, constrained to only that data.**

## What can go wrong with the AI response?

- It could answer confidently from outside the knowledge base (hallucination) — e.g. inventing
  a spa or a discount that doesn't exist.
- It could agree with a false premise embedded in the guest's question rather than correcting it
  (tested explicitly — see `TEST_RESULTS.md` scenario B6).
- It could be slow or the API could be rate-limited/unavailable (free-tier Gemini has request
  limits — see `README.md`).
- It could return an empty or malformed response.

## How would you prevent hallucinations or unsupported answers?

- **Grounding, not general knowledge**: the system prompt explicitly instructs the model to
  answer *only* from the supplied hotel-information block and to output a fixed sentinel
  (`NOT_FOUND`) rather than guess when the answer isn't there — see `chat-orchestrator.ts`.
- **The sentinel is mapped server-side**, not trusted verbatim: if the model doesn't cooperate
  and answers anyway when it shouldn't, that's a real residual risk with prompt-only
  grounding — the mitigation for production would be adding a lightweight
  groundedness/fact-check pass (e.g. asking a second, cheaper model call "is this claim
  supported by the following text: ...") before showing the answer, or switching to retrieval
  with citations. For this assignment's scope, prompt-level grounding plus the sentinel
  contract was the right tradeoff of effort vs. risk.
- **Anything with a real business-correctness cost (availability, pricing) never goes through
  the LLM at all** — see the deterministic/AI split above. This is the single biggest
  hallucination mitigation: the LLM is never in a position to hallucinate a room being
  available when it isn't, because it never touches that decision.
- **Tests explicitly assert against hallucination**, not just happy-path correctness — see
  `TEST_RESULTS.md` B4 (out-of-scope question → fallback, not hallucination) and B6 (false
  premise → corrected, not agreed with).

## What should happen when the model, frontend API call, or another dependency fails?

- **Model failure** (Gemini throws, times out, or returns nothing usable): caught in
  `ChatOrchestrator`, returned as a structured `type: 'error'`, `code: 'LLM_ERROR'`, HTTP 500 —
  never an unhandled exception. Logged with the request's `requestId` for traceability.
- **Frontend API call failure** (network error or the 15s client-side timeout fires): the chat
  UI shows an inline error message distinct from a normal reply, with a **Retry** button that
  resends the exact same request — verified to not duplicate the guest's original message
  (`components/Chat.test.tsx`, scenario F2).
- **Invalid input** (malformed JSON, missing/wrong-shaped fields): rejected at the validation
  layer with HTTP 400 and a specific error message, before any LLM or business logic runs.
- In every case the guest sees **plain language**, never a stack trace or a raw error code.

## How would you measure whether the feature is actually useful?

For this assignment's scope (no real users, no analytics pipeline), the honest answer is: it
can't be measured yet, and I'd be skeptical of anyone claiming otherwise without instrumentation
in place. What I'd actually build first, in priority order:
1. **Fallback rate** — what fraction of knowledge questions hit `NOT_FOUND`/fallback. A rising
   trend means the KB is missing content guests actually ask about — the single most
   actionable signal, and cheap to compute from the existing structured logs.
2. **Availability-to-clarify ratio** — how often guests have to be asked for missing info vs.
   giving complete details up front, as a proxy for whether the chat-first UX (vs. a plain
   form) is actually reducing friction or adding a round trip.
3. **Retry/error rate** — how often guests hit the error state at all.
4. **Session completion** — did an availability conversation end in the guest seeing results
   (vs. abandoning at the clarify step), and for FAQ questions, whether a follow-up
   *repeats* the same question (a proxy for "the first answer didn't help").
None of this requires new instrumentation surfaces beyond what's already logged
(`{requestId, intent, outcome}`) plus wiring it to a real store instead of `console.log`.

## What would you improve before taking this to production?

- **Replace prompt-only grounding with retrieval + citations** once the KB grows beyond a size
  that fits entirely in a system prompt, and add an explicit groundedness check.
- **Persist conversation state server-side** (keyed by session) instead of resending full
  history from the client on every request — fine at this scale, wouldn't scale token-cost-wise
  for long conversations.
- **Real availability data**, not a deterministic mock — wire `checkAvailability()` to an actual
  PMS/booking system behind the same function signature (the interface was deliberately kept
  narrow so this swap doesn't touch the orchestrator).
- **Rate limiting and abuse protection** on the API route — currently nothing stops repeated
  automated hammering of the Gemini-backed endpoint.
- **Structured log storage + the metrics above**, wired to a real dashboard instead of
  `console.log`.
- **Automated frontend E2E against a real (not mocked) backend**, e.g. Playwright, as a
  complement to the current mocked-backend component tests.
- Actually deploy it (see below) and do multi-browser/device manual verification beyond the
  single mobile-viewport check done here.

## Note on deployment

This submission is verified locally and via a screen recording rather than a live Vercel
deployment. Given the ~27-hour turnaround from receiving the assignment to the deadline, and
that the assignment explicitly lists a deployed URL as optional ("optional: a deployed demo URL
**or** a short screen recording"), deployment was deliberately sequenced last and only
attempted if time remained after every required deliverable (code, tests, docs) was complete
and verified — see the development plan's Step 14. This is a considered prioritization
decision, not an oversight.

## AI tools used during development

This entire assignment — planning, implementation, debugging, and this documentation — was
built with **Claude Code** (Anthropic), working from a development plan drafted collaboratively
in a prior planning session and refined against the assignment brief before any code was
written. Every technical decision recorded in this document reflects an actual choice made
(and, where noted, a real bug found and fixed) during that process — not a template answer.
