# API Examples

All examples target `POST /api/chat` against a local dev server (`npm run dev`,
`http://localhost:3000`). Request/response shapes follow the `ChatApiResponse` contract in
`ARCHITECTURE.md`. The first four examples below are **real, captured output** from a running
local instance (not hand-written) — the availability ones needed no API key at all, since that
path is fully deterministic; the validation and no-key examples are genuine failure cases
captured as-is.

## 1. Availability question with missing info → `clarify`

```bash
curl -s -X POST localhost:3000/api/chat \
  -H "Content-Type: application/json" \
  -d '{"message":"do you have any rooms available for 2 adults?","history":[]}'
```

```json
{
  "requestId": "64282ba5-6807-4a09-be2a-39c0ace142cd",
  "type": "clarify",
  "reply": "Sure — could you tell me the check-in date and check-out date so I can check availability?",
  "missing": ["checkIn", "checkOut"],
  "partial": { "adults": 2 }
}
```

Note `adults: 2` was already extracted from the message and is returned in `partial` — only the
still-missing fields are asked for (see `DECISIONS.md` and `AvailabilityForm.tsx`).

## 2. Availability question, complete → `availability_result`

```bash
curl -s -X POST localhost:3000/api/chat \
  -H "Content-Type: application/json" \
  -d '{"message":"do you have rooms available from 2026-09-15 to 2026-09-18 for 2 adults","history":[]}'
```

```json
{
  "requestId": "15af6c82-4aa6-4905-8501-bffefbcc89ff",
  "type": "availability_result",
  "reply": "Here's what's available for 2 guest(s) from 2026-09-15 to 2026-09-18.",
  "query": { "checkIn": "2026-09-15", "checkOut": "2026-09-18", "adults": 2 },
  "rooms": [
    { "roomType": "Standard Room", "price": 4500, "capacity": 2, "available": true },
    { "roomType": "Deluxe Room", "price": 6200, "capacity": 3, "available": true },
    { "roomType": "Executive Suite", "price": 9500, "capacity": 4, "available": true },
    { "roomType": "Family Suite", "price": 11800, "capacity": 5, "available": false }
  ]
}
```

## 3. Failure case — invalid request body → HTTP 400

```bash
curl -s -w "\nHTTP %{http_code}\n" -X POST localhost:3000/api/chat \
  -H "Content-Type: application/json" \
  -d '{"history":[]}'
```

```json
{
  "requestId": "60958c66-0ebf-4d24-afba-4eab47377fd2",
  "type": "error",
  "code": "VALIDATION_ERROR",
  "reply": "A non-empty \"message\" string is required."
}
```
```
HTTP 400
```

## 4. Failure case — knowledge question with no Gemini API key configured → HTTP 500

This is a genuine, reproducible failure case (not simulated): with `GOOGLE_GEMINI_API_KEY`
unset, any question that needs the LLM fails gracefully rather than crashing. Availability
questions (examples 1–2 above) are unaffected, since that path never touches the LLM.

```bash
curl -s -w "\nHTTP %{http_code}\n" -X POST localhost:3000/api/chat \
  -H "Content-Type: application/json" \
  -d '{"message":"is breakfast included?","history":[]}'
```

```json
{
  "requestId": "2f58dee4-9d52-439e-ae5c-c8d264dfa635",
  "type": "error",
  "code": "LLM_ERROR",
  "reply": "Something went wrong while getting a response. Please try again."
}
```
```
HTTP 500
```

## 5. Normal knowledge question (expected shape once `GOOGLE_GEMINI_API_KEY` is set)

Shown for completeness — this is the contract's `answer` shape, illustrated rather than
captured live (this repo isn't shipped with a real key). Once a key is configured per
`README.md`:

```bash
curl -s -X POST localhost:3000/api/chat \
  -H "Content-Type: application/json" \
  -d '{"message":"what time is check-in?","history":[]}'
```

```json
{
  "requestId": "<uuid>",
  "type": "answer",
  "reply": "Check-in is at 2:00 PM."
}
```

## 6. Follow-up question (uses conversation history)

```bash
curl -s -X POST localhost:3000/api/chat \
  -H "Content-Type: application/json" \
  -d '{
    "message": "what about for 4 guests?",
    "history": [
      { "role": "user", "content": "is the standard room good for a family?" },
      { "role": "assistant", "content": "The Standard Room fits up to 2 guests." }
    ]
  }'
```

Expected shape (`type: 'answer'`, once a key is configured) — the model is given the prior two
turns so it can resolve "what about" against the earlier topic (room capacity), rather than
treating the message as a standalone, ambiguous fragment. Covered without a live key by
`lib/chat-orchestrator.test.ts`'s history-folding test (asserts the exact prompt text sent to
the LLM includes both prior turns).
