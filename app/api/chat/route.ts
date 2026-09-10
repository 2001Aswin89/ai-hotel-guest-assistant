import { randomUUID } from 'node:crypto';
import type { ChatApiRequest, ChatApiResponse } from '@/lib/api-types';
import { KnowledgeBase } from '@/lib/knowledge-base';
import { GeminiProvider } from '@/lib/llm-provider';

// Sentinel the model is instructed to output when the answer isn't grounded
// in the knowledge base, mapped to a friendly fallback reply below instead
// of being shown to the guest or treated as an error.
const NOT_FOUND_SENTINEL = 'NOT_FOUND';

const FALLBACK_REPLY =
  "I don't have that information available. Please contact the front desk directly for details on this.";

function buildSystemPrompt(context: string): string {
  return [
    "You are a helpful guest assistant for a hotel. Answer the guest's question using ONLY the hotel information below.",
    `If the answer is not contained in this information, respond with exactly: ${NOT_FOUND_SENTINEL}`,
    "Do not guess, invent, or assume anything not stated below. Keep answers concise and friendly.",
    '',
    '--- HOTEL INFORMATION ---',
    context,
    '--- END HOTEL INFORMATION ---',
  ].join('\n');
}

export async function POST(request: Request): Promise<Response> {
  const requestId = randomUUID();

  try {
    const body = (await request.json()) as ChatApiRequest;

    if (!body?.message || typeof body.message !== 'string') {
      const res: ChatApiResponse = {
        requestId,
        type: 'error',
        code: 'VALIDATION_ERROR',
        reply: 'A non-empty "message" string is required.',
      };
      return Response.json(res, { status: 400 });
    }

    const knowledgeBase = new KnowledgeBase();
    const llmProvider = new GeminiProvider();

    const systemPrompt = buildSystemPrompt(knowledgeBase.getFullContextText());
    const rawReply = await llmProvider.generate(body.message, systemPrompt);

    const reply = rawReply.trim() === NOT_FOUND_SENTINEL ? FALLBACK_REPLY : rawReply.trim();

    const res: ChatApiResponse = { requestId, type: 'answer', reply };
    return Response.json(res, { status: 200 });
  } catch (error) {
    console.error(`[chat] requestId=${requestId} error:`, error);
    const res: ChatApiResponse = {
      requestId,
      type: 'error',
      code: 'LLM_ERROR',
      reply: 'Something went wrong while getting a response. Please try again.',
    };
    return Response.json(res, { status: 500 });
  }
}
