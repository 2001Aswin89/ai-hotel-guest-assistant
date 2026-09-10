import type { ChatApiRequest, ChatMessage } from '@/lib/api-types';

export type ValidationResult =
  | { valid: true; data: ChatApiRequest }
  | { valid: false; error: string };

function isChatMessage(value: unknown): value is ChatMessage {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  return (v.role === 'user' || v.role === 'assistant') && typeof v.content === 'string';
}

/**
 * Basic request-shape validation (SRP), kept separate from ChatOrchestrator's
 * conversational logic so both the route and tests can reuse it directly.
 */
export function validateChatRequest(body: unknown): ValidationResult {
  if (typeof body !== 'object' || body === null) {
    return { valid: false, error: 'Request body must be a JSON object.' };
  }

  const b = body as Record<string, unknown>;

  if (typeof b.message !== 'string' || b.message.trim().length === 0) {
    return { valid: false, error: 'A non-empty "message" string is required.' };
  }

  if (b.history !== undefined) {
    if (!Array.isArray(b.history) || !b.history.every(isChatMessage)) {
      return {
        valid: false,
        error: '"history" must be an array of { role: "user" | "assistant", content: string }.',
      };
    }
  }

  if (b.availabilityParams !== undefined) {
    if (typeof b.availabilityParams !== 'object' || b.availabilityParams === null) {
      return { valid: false, error: '"availabilityParams" must be an object when provided.' };
    }
  }

  return {
    valid: true,
    data: {
      message: b.message,
      history: (b.history as ChatMessage[] | undefined) ?? [],
      availabilityParams: b.availabilityParams as ChatApiRequest['availabilityParams'],
    },
  };
}
