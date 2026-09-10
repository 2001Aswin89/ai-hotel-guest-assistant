# Hotel Guest Assistant

AI-powered guest assistant for a hotel website — chat Q&A grounded in a hotel knowledge base, plus a deterministic room-availability check.

> This README will grow through the build (see `requirements/hotel-guest-assistant-dev-plan.md` in the project's requirements folder for the full plan). Right now it only covers project scaffolding.

## Setup

1. Install dependencies:
   ```bash
   npm install
   ```
2. Copy the env template and fill in your Gemini API key:
   ```bash
   cp .env.example .env.local
   ```
   Set `GOOGLE_GEMINI_API_KEY` in `.env.local` (never commit this file — it's gitignored).

## Run

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Tests

Not yet wired up — added in a later step.
