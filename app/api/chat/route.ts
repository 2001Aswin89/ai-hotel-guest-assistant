import { randomUUID } from 'node:crypto';
import type { ChatApiResponse } from '@/lib/api-types';
import { ChatOrchestrator } from '@/lib/chat-orchestrator';
import { GeminiProvider } from '@/lib/llm-provider';
import { validateChatRequest } from '@/lib/validate-chat-request';

export async function POST(request: Request): Promise<Response> {
  const requestId = randomUUID();

  try {
    const rawBody: unknown = await request.json().catch(() => undefined);
    const validation = validateChatRequest(rawBody);

    if (!validation.valid) {
      console.log(
        JSON.stringify({ requestId, intent: 'n/a', outcome: 'validation_error', error: validation.error }),
      );
      const res: ChatApiResponse = {
        requestId,
        type: 'error',
        code: 'VALIDATION_ERROR',
        reply: validation.error,
      };
      return Response.json(res, { status: 400 });
    }

    const orchestrator = new ChatOrchestrator(new GeminiProvider());
    const { status, body: responseBody } = await orchestrator.handle(validation.data, requestId);
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
