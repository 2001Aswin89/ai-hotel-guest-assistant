import type { AvailabilityQuery, ChatApiRequest, ChatApiResponse } from '@/lib/api-types';
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

function buildSystemPrompt(context: string): string {
  return [
    "You are a helpful guest assistant for a hotel. Answer the guest's question using ONLY the hotel information below.",
    `If the answer is not contained in this information, respond with exactly: ${NOT_FOUND_SENTINEL}`,
    'Do not guess, invent, or assume anything not stated below. Keep answers concise and friendly.',
    '',
    '--- HOTEL INFORMATION ---',
    context,
    '--- END HOTEL INFORMATION ---',
  ].join('\n');
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

      return {
        status: 200,
        body: { requestId, type: 'availability_result', reply, query: { checkIn, checkOut, adults }, rooms },
      };
    }

    try {
      const systemPrompt = buildSystemPrompt(this.knowledgeBase.getFullContextText());
      const rawReply = await this.llmProvider.generate(request.message, systemPrompt);
      const reply = rawReply.trim() === NOT_FOUND_SENTINEL ? FALLBACK_REPLY : rawReply.trim();
      return { status: 200, body: { requestId, type: 'answer', reply } };
    } catch (error) {
      console.error(`[chat-orchestrator] requestId=${requestId} llm error:`, error);
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
