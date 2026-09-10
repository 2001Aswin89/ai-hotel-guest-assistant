import { describe, expect, it } from 'vitest';
import { validateChatRequest } from './validate-chat-request';

describe('validateChatRequest', () => {
  // B8 — invalid request bodies are rejected with a clear, structured error.
  it('rejects a body with no message', () => {
    const result = validateChatRequest({ history: [] });
    expect(result.valid).toBe(false);
  });

  it('rejects a body with an empty/whitespace-only message', () => {
    const result = validateChatRequest({ message: '   ', history: [] });
    expect(result.valid).toBe(false);
  });

  it('rejects a body whose history is not an array', () => {
    const result = validateChatRequest({ message: 'hi', history: 'not-an-array' });
    expect(result.valid).toBe(false);
  });

  it('rejects a history entry with a bad role', () => {
    const result = validateChatRequest({
      message: 'hi',
      history: [{ role: 'system', content: 'x' }],
    });
    expect(result.valid).toBe(false);
  });

  it('rejects a non-object body', () => {
    expect(validateChatRequest('nope').valid).toBe(false);
    expect(validateChatRequest(null).valid).toBe(false);
    expect(validateChatRequest(undefined).valid).toBe(false);
  });

  it('accepts a well-formed body and defaults history to []', () => {
    const result = validateChatRequest({ message: 'hi' });
    expect(result.valid).toBe(true);
    if (result.valid) {
      expect(result.data.history).toEqual([]);
    }
  });

  it('accepts a well-formed body with history and availabilityParams', () => {
    const result = validateChatRequest({
      message: 'hi',
      history: [{ role: 'user', content: 'hi' }],
      availabilityParams: { adults: 2 },
    });
    expect(result.valid).toBe(true);
  });
});
