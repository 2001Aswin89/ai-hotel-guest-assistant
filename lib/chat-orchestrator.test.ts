import { describe, expect, it, vi } from 'vitest';
import { ChatOrchestrator } from './chat-orchestrator';
import { checkAvailability } from './availability-tool';
import type { LlmProvider } from './llm-provider';
import type { ChatApiRequest } from './api-types';

function fakeLlm(reply: string | ((prompt: string) => string)): LlmProvider {
  return {
    async generate(prompt: string) {
      return typeof reply === 'function' ? reply(prompt) : reply;
    },
  };
}

function request(overrides: Partial<ChatApiRequest> = {}): ChatApiRequest {
  return { message: '', history: [], ...overrides };
}

describe('ChatOrchestrator', () => {
  // B1 — normal guest question answered from KB via the LLM path.
  it('answers a normal FAQ question from the knowledge base', async () => {
    const orchestrator = new ChatOrchestrator(fakeLlm('Yes, breakfast is included.'));
    const { status, body } = await orchestrator.handle(
      request({ message: 'is breakfast included?' }),
      'req-1',
    );

    expect(status).toBe(200);
    expect(body.type).toBe('answer');
    if (body.type === 'answer') {
      expect(body.reply).toBe('Yes, breakfast is included.');
    }
  });

  // B2 — availability question with all params present calls the tool with the right args.
  it('calls checkAvailability with the extracted args when all params are present', async () => {
    const toolSpy = vi.fn(checkAvailability);
    const orchestrator = new ChatOrchestrator(fakeLlm('unused'), undefined, undefined, toolSpy);
    const { status, body } = await orchestrator.handle(
      request({ message: 'do you have rooms available from 2026-09-15 to 2026-09-18 for 2 adults' }),
      'req-2',
    );

    expect(status).toBe(200);
    expect(body.type).toBe('availability_result');
    expect(toolSpy).toHaveBeenCalledTimes(1);
    expect(toolSpy.mock.calls[0][0]).toBe('2026-09-15');
    expect(toolSpy.mock.calls[0][1]).toBe('2026-09-18');
    expect(toolSpy.mock.calls[0][2]).toBe(2);
  });

  // B3 — availability question missing params returns a clarifying question, not a guess.
  it('asks a clarifying question when availability params are missing', async () => {
    const orchestrator = new ChatOrchestrator(fakeLlm('unused'));
    const { status, body } = await orchestrator.handle(
      request({ message: 'do you have any rooms available?' }),
      'req-3',
    );

    expect(status).toBe(200);
    expect(body.type).toBe('clarify');
    if (body.type === 'clarify') {
      expect(body.missing).toEqual(['checkIn', 'checkOut', 'adults']);
      expect(body.partial).toEqual({ checkIn: undefined, checkOut: undefined, adults: undefined });
    }
  });

  // B4 — question outside KB scope maps the NOT_FOUND sentinel to a fallback, never a hallucination.
  it('returns a friendly fallback (not the raw sentinel) when the answer is not in the KB', async () => {
    const orchestrator = new ChatOrchestrator(fakeLlm('NOT_FOUND'));
    const { status, body } = await orchestrator.handle(
      request({ message: 'do you have a helicopter pad?' }),
      'req-4',
    );

    expect(status).toBe(200);
    expect(body.type).toBe('answer');
    if (body.type === 'answer') {
      expect(body.reply).not.toBe('NOT_FOUND');
      expect(body.reply.toLowerCase()).toContain("don't have");
    }
  });

  // B5 — ambiguous relative-date availability question ("next week") can't be parsed
  // deterministically, so it safely falls back to a clarifying question instead of guessing dates.
  it('treats an ambiguous relative date as missing info and asks to clarify', async () => {
    const orchestrator = new ChatOrchestrator(fakeLlm('unused'));
    const { body } = await orchestrator.handle(
      request({ message: 'do you have any availability next week?' }),
      'req-5',
    );

    expect(body.type).toBe('clarify');
    if (body.type === 'clarify') {
      expect(body.missing).toContain('checkIn');
      expect(body.missing).toContain('checkOut');
    }
  });

  // B6 — guest asserts something false about the property; the model (grounded to say
  // NOT_FOUND for anything unsupported) should correct rather than play along.
  it('does not agree with a false premise not supported by the KB', async () => {
    const orchestrator = new ChatOrchestrator(
      fakeLlm((prompt) => (prompt.includes('spa') ? 'NOT_FOUND' : 'unexpected prompt')),
    );
    const { body } = await orchestrator.handle(
      request({ message: 'since you have a spa, is a couples massage included free?' }),
      'req-6',
    );

    expect(body.type).toBe('answer');
    if (body.type === 'answer') {
      expect(body.reply).not.toMatch(/yes.*included/i);
    }
  });

  // B7 — a follow-up question uses the prior conversation turns as context.
  it('folds conversation history into the prompt for follow-up questions', async () => {
    let receivedPrompt = '';
    const orchestrator = new ChatOrchestrator(
      fakeLlm((prompt) => {
        receivedPrompt = prompt;
        return 'The Deluxe Room fits up to 3 guests.';
      }),
    );
    await orchestrator.handle(
      request({
        message: 'what about for 3 guests?',
        history: [
          { role: 'user', content: 'is the standard room good for a family?' },
          { role: 'assistant', content: 'The Standard Room fits up to 2 guests.' },
        ],
      }),
      'req-7',
    );

    expect(receivedPrompt).toContain('is the standard room good for a family?');
    expect(receivedPrompt).toContain('what about for 3 guests?');
  });

  // B9 — the LLM provider throwing produces a graceful structured error, not a crash.
  it('returns a graceful error when the LLM provider throws', async () => {
    const throwingLlm: LlmProvider = {
      async generate() {
        throw new Error('upstream Gemini failure');
      },
    };
    const orchestrator = new ChatOrchestrator(throwingLlm);
    const { status, body } = await orchestrator.handle(
      request({ message: 'what time is check-in?' }),
      'req-9',
    );

    expect(status).toBe(500);
    expect(body.type).toBe('error');
    if (body.type === 'error') {
      expect(body.code).toBe('LLM_ERROR');
    }
  });

  // B10 — no rooms available for the given dates still returns a UI-friendly result, not an error.
  it('returns a UI-friendly availability_result when no rooms are available', async () => {
    const noRoomsTool = vi.fn(() => [
      { roomType: 'Standard Room', price: 4500, capacity: 2, available: false },
    ]);
    const orchestrator = new ChatOrchestrator(fakeLlm('unused'), undefined, undefined, noRoomsTool);
    const { status, body } = await orchestrator.handle(
      request({ message: 'rooms available from 2026-12-24 to 2026-12-26 for 2 adults' }),
      'req-10',
    );

    expect(status).toBe(200);
    expect(body.type).toBe('availability_result');
    if (body.type === 'availability_result') {
      expect(body.rooms.every((r) => !r.available)).toBe(true);
      expect(body.reply.toLowerCase()).toContain('no rooms are available');
    }
  });
});
