import { randomUUID } from 'node:crypto';
import type { ChatApiRequest, ChatApiResponse } from '@/lib/api-types';
import { ChatOrchestrator } from '@/lib/chat-orchestrator';
import { GeminiProvider } from '@/lib/llm-provider';

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

    const orchestrator = new ChatOrchestrator(new GeminiProvider());
    const { status, body: responseBody } = await orchestrator.handle(body, requestId);
    return Response.json(responseBody, { status });
  } catch (error) {
    console.error(`[chat] requestId=${requestId} error:`, error);
    const res: ChatApiResponse = {
      requestId,
      type: 'error',
      code: 'INTERNAL_ERROR',
      reply: 'Something went wrong while getting a response. Please try again.',
    };
    return Response.json(res, { status: 500 });
  }
}
