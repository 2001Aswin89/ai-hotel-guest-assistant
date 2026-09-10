import type { ChatApiRequest, ChatApiResponse } from '@/lib/api-types';

const DEFAULT_TIMEOUT_MS = 15000;

/**
 * Thin fetch wrapper around POST /api/chat. Kept as its own function (rather
 * than inlined in the component) so Step 10's frontend tests can mock it
 * directly instead of mocking global fetch everywhere.
 *
 * Throws (rather than returning) on network failure or timeout — those are
 * distinct from a backend-reported `type: 'error'`, which is still a
 * successful HTTP round-trip and is returned normally for the caller to
 * branch on.
 */
export async function sendChatMessage(
  payload: ChatApiRequest,
  options: { timeoutMs?: number } = {},
): Promise<ChatApiResponse> {
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  let res: Response;
  try {
    res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw new Error('The request took too long to respond. Please try again.');
    }
    throw new Error('Could not reach the server. Please check your connection and try again.');
  } finally {
    clearTimeout(timeoutId);
  }

  let data: ChatApiResponse;
  try {
    data = (await res.json()) as ChatApiResponse;
  } catch {
    throw new Error('Received an unexpected response from the server.');
  }

  if (!res.ok && data.type !== 'error') {
    // Defensive: a non-2xx response that somehow isn't shaped like our error type.
    throw new Error(`Chat request failed with status ${res.status}`);
  }

  return data;
}
