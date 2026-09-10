import type { ChatApiRequest, ChatApiResponse } from '@/lib/api-types';

/**
 * Thin fetch wrapper around POST /api/chat. Kept as its own function (rather
 * than inlined in the component) so Step 10's frontend tests can mock it
 * directly instead of mocking global fetch everywhere.
 */
export async function sendChatMessage(payload: ChatApiRequest): Promise<ChatApiResponse> {
  const res = await fetch('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  const data = (await res.json()) as ChatApiResponse;

  if (!res.ok && data.type !== 'error') {
    // Defensive: a non-2xx response that somehow isn't shaped like our error type.
    throw new Error(`Chat request failed with status ${res.status}`);
  }

  return data;
}
