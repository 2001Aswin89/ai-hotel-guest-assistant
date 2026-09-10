# Hotel Guest Assistant

AI-powered guest assistant for a hotel website — a chat interface where guests can ask
questions about the property (check-in times, amenities, room types, policies, FAQs) and
check room availability, backed by a Next.js API route that grounds an LLM in a small
JSON knowledge base and keeps availability checking fully deterministic.

Built for the Simplotel "Build a Full-Stack AI-Powered Hotel Guest Assistant" assignment.
See [`ARCHITECTURE.md`](./ARCHITECTURE.md) for how it's put together, [`DECISIONS.md`](./DECISIONS.md)
for the product/AI/UX reasoning, [`API_EXAMPLES.md`](./API_EXAMPLES.md) for curl examples,
and [`TEST_RESULTS.md`](./TEST_RESULTS.md) for the evaluation scenarios and observed results.

## Stack

Next.js 16 (App Router) + TypeScript, Tailwind CSS, Google Gemini (`@google/genai`), Vitest +
React Testing Library. See `requirements/hotel-guest-assistant-dev-plan.md` in the project's
requirements folder for the full build plan this was developed against.

## Setup

1. Install dependencies:
   ```bash
   npm install
   ```
2. Copy the env template and add your Gemini API key:
   ```bash
   cp .env.example .env.local
   ```
   Set `GOOGLE_GEMINI_API_KEY` in `.env.local` — **never commit this file** (it's gitignored).

   **Getting a free API key:**
   1. Go to [aistudio.google.com/apikey](https://aistudio.google.com/apikey) and sign in with a Google account.
   2. Click **Create API key** (a new Google Cloud project is created automatically if you don't have one).
   3. Copy the key into `.env.local` as `GOOGLE_GEMINI_API_KEY=<your key>`.

   **Choosing a model (free tier):** this app defaults to `gemini-3.5-flash-lite` if
   `GEMINI_MODEL` is left unset in `.env.local`. Google's Gemini model lineup and free-tier
   rate limits (requests-per-minute, requests-per-day, tokens-per-minute) change frequently —
   **the model landscape moves fast enough that even this README can go stale**: during
   development, both `gemini-2.5-flash` and `gemini-2.5-flash-lite` (the models originally
   chosen here based on published rate-limit comparisons) turned out to have already been
   retired for new API keys by the time of testing — the live API returned a 404 naming their
   3.x replacements. **If `gemini-3.5-flash-lite` also errors by the time you read this, check
   the exact error message** — Gemini API 404s for a retired model name the correct current
   replacement directly — or check [ai.google.dev/gemini-api/docs/models](https://ai.google.dev/gemini-api/docs/models)
   and your account's live limits at [aistudio.google.com/rate-limit](https://aistudio.google.com/rate-limit).

   As a naming-pattern rule of thumb (verified true for the 2.5 → 3.x transition, likely to
   hold going forward) for this app's traffic pattern (one small request per guest message,
   grounded in a short fixed knowledge base — not high-volume, doesn't need top-tier reasoning):
   - **`gemini-<version>-flash-lite`** (default) — the "lite" variant consistently carries
     meaningfully higher free-tier request allowances than plain "flash" for a small quality
     tradeoff that doesn't matter here.
   - **`gemini-<version>-flash`** — use this instead if you need noticeably better answer
     quality and can tolerate a lower daily/per-minute request ceiling.
   - Avoid `-pro` tier models for this project — free-tier allowance is much lower and the
     extra reasoning quality isn't needed for grounded FAQ/availability answers.

   To use a different model, set `GEMINI_MODEL=<model-name>` in `.env.local`.

## Run

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

Try: "what time is check-in?", "is breakfast included?", "do you have rooms available for
2 adults?" (triggers the date/guest picker), then a follow-up like "what about for 4 guests?".

## Tests

```bash
npm test
```

Runs the full Vitest suite (backend: `ChatOrchestrator`, request validation, and a real
end-to-end request through the `/api/chat` route handler; frontend: loading/error states and
a mocked full chat-to-availability flow, via React Testing Library). See
[`TEST_RESULTS.md`](./TEST_RESULTS.md) for the full scenario list and observed output.

```bash
npm run lint       # ESLint
npx tsc --noEmit   # TypeScript type-check
```

## Project structure

```
/app
  /api/chat/route.ts     — POST /api/chat (validates, delegates to ChatOrchestrator)
  page.tsx                — home page, renders <Chat />
/components
  Chat.tsx                — chat UI: message list, input, loading/error states
  AvailabilityForm.tsx    — date/guest picker for a "clarify" response
  AvailabilityResults.tsx — room availability cards
  ErrorState.tsx          — inline error + retry
/lib
  knowledge-base.ts       — typed KB loader (getPolicies/getRooms/getAmenities/getFaqs/getFullContextText)
  llm-provider.ts         — LlmProvider interface + GeminiProvider
  availability-tool.ts    — deterministic checkAvailability()
  intent-classifier.ts    — keyword-based availability-vs-knowledge routing
  chat-orchestrator.ts    — composes the above into a ChatApiResponse
  validate-chat-request.ts, api-types.ts, chat-client.ts
/data/hotel-kb.json       — the hotel's knowledge base
```

## Deployment

Not deployed for this submission within the assignment's time window — see
[`DECISIONS.md`](./DECISIONS.md) for why, and the app was verified locally instead (a short
screen recording is included with the submission). If deploying to Vercel: import the repo,
set `GOOGLE_GEMINI_API_KEY` (and optionally `GEMINI_MODEL`) as environment variables in the
Vercel project settings — never in code — and deploy; no other configuration is required.
