import type { AvailabilityQuery, ChatApiRequest, ChatApiResponse, ChatMessage } from '@/lib/api-types';
import { checkAvailability } from '@/lib/availability-tool';
import { IntentClassifier } from '@/lib/intent-classifier';
import { KnowledgeBase } from '@/lib/knowledge-base';
import type { LlmProvider } from '@/lib/llm-provider';

// Sentinel the model is instructed to output when the answer isn't grounded
// in the knowledge base, mapped to a friendly fallback reply instead of
// being shown to the guest or treated as an error.
const NOT_FOUND_SENTINEL = 'NOT_FOUND';

const FALLBACK_REPLY =
  "I don't have that information available. Please contact the front desk directly for details on this.";

// How many prior turns to fold into the prompt for follow-up context.
// Bounded so the prompt doesn't grow unboundedly over a long conversation.
const MAX_HISTORY_TURNS = 6;

function buildSystemPrompt(context: string): string {
  return [
    "You are a helpful guest assistant for a hotel. Answer the guest's question using ONLY the hotel information below.",
    `If the answer is not contained in this information, respond with exactly: ${NOT_FOUND_SENTINEL}`,
    'Do not guess, invent, or assume anything not stated below. Keep answers concise and friendly.',
    'Use the conversation so far to understand follow-up questions (e.g. "what about for 4 guests" referring to a prior topic).',
    '',
    '--- HOTEL INFORMATION ---',
    context,
    '--- END HOTEL INFORMATION ---',
  ].join('\n');
}

function buildPromptWithHistory(history: ChatMessage[], message: string): string {
  const recent = history.slice(-MAX_HISTORY_TURNS);
  if (recent.length === 0) {
    return message;
  }
  const transcript = recent.map((m) => `${m.role}: ${m.content}`).join('\n');
  return `--- CONVERSATION SO FAR ---\n${transcript}\n--- END CONVERSATION SO FAR ---\n\nuser: ${message}`;
}

function buildClarifyReply(missing: string[]): string {
  const labels: Record<string, string> = {
    checkIn: 'check-in date',
    checkOut: 'check-out date',
    adults: 'number of guests',
  };
  const parts = missing.map((m) => labels[m] ?? m);
  return `Sure — could you tell me the ${parts.join(' and ')} so I can check availability?`;
}

function logOutcome(requestId: string, intent: string, outcome: string): void {
  console.log(
    JSON.stringify({ requestId, intent, outcome, timestamp: new Date().toISOString() }),
  );
}

/**
 * Composes KnowledgeBase, IntentClassifier, the availability tool, and an
 * LlmProvider into one request handler. Contains no business logic of its
 * own (SRP/Open-Closed — see dev plan §4): adding a new tool means
 * registering it here, not rewriting this class's internals.
 *
 * All dependencies are injected (Dependency Inversion) so tests can supply a
 * fake LlmProvider without ever hitting the real Gemini API.
 */
export class ChatOrchestrator {
  constructor(
    private readonly llmProvider: LlmProvider,
    private readonly knowledgeBase: KnowledgeBase = new KnowledgeBase(),
    private readonly intentClassifier: IntentClassifier = new IntentClassifier(),
    private readonly availabilityTool: typeof checkAvailability = checkAvailability,
  ) {}

  async handle(
    request: ChatApiRequest,
    requestId: string,
  ): Promise<{ status: number; body: ChatApiResponse }> {
    const intent = this.intentClassifier.classify(request.message, request.availabilityParams);

    if (intent.intent === 'availability') {
      if (intent.missing.length > 0) {
        logOutcome(requestId, 'availability', 'clarify');
        return {
          status: 200,
          body: {
            requestId,
            type: 'clarify',
            reply: buildClarifyReply(intent.missing),
            missing: intent.missing,
          },
        };
      }

      const { checkIn, checkOut, adults } = intent.params as AvailabilityQuery;
      const rooms = this.availabilityTool(checkIn, checkOut, adults, this.knowledgeBase);
      const anyAvailable = rooms.some((r) => r.available);
      const reply = anyAvailable
        ? `Here's what's available for ${adults} guest(s) from ${checkIn} to ${checkOut}.`
        : `Sorry, no rooms are available for ${adults} guest(s) from ${checkIn} to ${checkOut}. Please try different dates.`;

      logOutcome(requestId, 'availability', anyAvailable ? 'availability_result' : 'no_availability');
      return {
        status: 200,
        body: { requestId, type: 'availability_result', reply, query: { checkIn, checkOut, adults }, rooms },
      };
    }

    try {
      const systemPrompt = buildSystemPrompt(this.knowledgeBase.getFullContextText());
      const prompt = buildPromptWithHistory(request.history, request.message);
      const rawReply = await this.llmProvider.generate(prompt, systemPrompt);
      const trimmed = rawReply.trim();
      const reply = trimmed === NOT_FOUND_SENTINEL ? FALLBACK_REPLY : trimmed;

      logOutcome(requestId, 'knowledge', trimmed === NOT_FOUND_SENTINEL ? 'fallback' : 'answer');
      return { status: 200, body: { requestId, type: 'answer', reply } };
    } catch (error) {
      console.error(`[chat-orchestrator] requestId=${requestId} llm error:`, error);
      logOutcome(requestId, 'knowledge', 'llm_error');
      return {
        status: 500,
        body: {
          requestId,
          type: 'error',
          code: 'LLM_ERROR',
          reply: 'Something went wrong while getting a response. Please try again.',
        },
      };
    }
  }
}
