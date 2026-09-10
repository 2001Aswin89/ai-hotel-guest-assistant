'use client';

import { useState, type FormEvent, type KeyboardEvent } from 'react';
import type { AvailabilityQuery, ChatApiResponse, ChatMessage } from '@/lib/api-types';
import { sendChatMessage } from '@/lib/chat-client';
import AvailabilityForm from '@/components/AvailabilityForm';
import AvailabilityResults from '@/components/AvailabilityResults';
import ErrorState from '@/components/ErrorState';

export interface UiMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  /** Full API response behind an assistant message — used to decide whether
   *  to render a clarify form / availability cards alongside the text. */
  response?: ChatApiResponse;
}

interface PendingRequest {
  message: string;
  history: ChatMessage[];
  availabilityParams?: AvailabilityQuery;
}

interface ErrorInfo {
  message: string;
  retry: PendingRequest;
}

function toHistory(messages: UiMessage[]): ChatMessage[] {
  return messages.map((m) => ({ role: m.role, content: m.content }));
}

function formatAvailabilitySubmission(params: AvailabilityQuery): string {
  return `Check-in ${params.checkIn}, check-out ${params.checkOut}, ${params.adults} guest(s)`;
}

function MessageBubble({ message }: { message: UiMessage }) {
  const isUser = message.role === 'user';
  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[90%] sm:max-w-[85%] rounded-2xl px-4 py-2 text-sm leading-relaxed whitespace-pre-wrap break-words ${
          isUser
            ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-black'
            : 'bg-zinc-100 text-zinc-900 dark:bg-zinc-800 dark:text-zinc-100'
        }`}
      >
        {message.content}
      </div>
    </div>
  );
}

function LoadingBubble() {
  return (
    <div className="flex justify-start">
      <div className="flex items-center gap-1 rounded-2xl bg-zinc-100 px-4 py-3 dark:bg-zinc-800">
        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-zinc-400 [animation-delay:-0.3s]" />
        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-zinc-400 [animation-delay:-0.15s]" />
        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-zinc-400" />
      </div>
    </div>
  );
}

const REQUEST_TIMEOUT_MS = 15000;

export default function Chat() {
  const [messages, setMessages] = useState<UiMessage[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content:
        "Hi! I'm the Harborview Grand Hotel guest assistant. Ask me about check-in times, amenities, room types, policies — or check room availability.",
    },
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<ErrorInfo | null>(null);

  /** Performs the network round-trip for an already-appended user message.
   *  Kept separate from the "append + clear input" step so Retry can re-run
   *  the exact same request without duplicating the user's chat bubble. */
  async function performRequest(request: PendingRequest) {
    setIsLoading(true);
    setError(null);
    try {
      const response = await sendChatMessage(
        {
          message: request.message,
          history: request.history,
          availabilityParams: request.availabilityParams,
        },
        { timeoutMs: REQUEST_TIMEOUT_MS },
      );

      if (response.type === 'error') {
        setError({ message: response.reply, retry: request });
        return;
      }

      const assistantMessage: UiMessage = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: response.reply,
        response,
      };
      setMessages((prev) => [...prev, assistantMessage]);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Something went wrong. Please try again.';
      setError({ message, retry: request });
    } finally {
      setIsLoading(false);
    }
  }

  async function sendMessage(overrideMessage?: string, availabilityParams?: AvailabilityQuery) {
    const trimmed = (overrideMessage ?? input).trim();
    if (!trimmed || isLoading) return;

    const userMessage: UiMessage = { id: crypto.randomUUID(), role: 'user', content: trimmed };
    const historyForRequest = toHistory(messages);
    setMessages((prev) => [...prev, userMessage]);
    setInput('');

    await performRequest({ message: trimmed, history: historyForRequest, availabilityParams });
  }

  function handleFormSubmit(e: FormEvent) {
    e.preventDefault();
    void sendMessage();
  }

  // Explicit handler instead of relying on the browser's implicit
  // submit-on-Enter: that behavior doesn't fire for synthetic/automated key
  // events and isn't implemented at all in jsdom (used by the Step 10 tests),
  // so it would be untestable and unreliable if left implicit.
  function handleInputKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      e.preventDefault();
      void sendMessage();
    }
  }

  function handleAvailabilitySubmit(params: AvailabilityQuery) {
    void sendMessage(formatAvailabilitySubmission(params), params);
  }

  function handleRetry() {
    if (!error) return;
    void performRequest(error.retry);
  }

  const lastMessageId = messages[messages.length - 1]?.id;

  return (
    <div className="flex h-[100dvh] w-full flex-col overflow-hidden bg-white dark:bg-zinc-950 sm:h-[85vh] sm:max-h-[720px] sm:w-full sm:max-w-2xl sm:rounded-2xl sm:border sm:border-zinc-200 sm:shadow-sm dark:sm:border-zinc-800">
      <header className="border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
        <h1 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">
          Harborview Grand Hotel
        </h1>
        <p className="text-xs text-zinc-500 dark:text-zinc-400">Guest Assistant</p>
      </header>

      <div className="flex-1 space-y-3 overflow-y-auto overflow-x-hidden px-3 py-4 sm:px-4">
        {messages.map((message) => {
          // Only the most recent assistant message is still actionable — an
          // older clarify/availability turn shouldn't keep showing a live form.
          const isActionable = message.id === lastMessageId && !isLoading;

          return (
            <div key={message.id} className="space-y-2">
              <MessageBubble message={message} />
              {isActionable && message.response?.type === 'clarify' && (
                <AvailabilityForm
                  missing={message.response.missing}
                  partial={message.response.partial}
                  onSubmit={handleAvailabilitySubmit}
                />
              )}
              {isActionable && message.response?.type === 'availability_result' && (
                <AvailabilityResults query={message.response.query} rooms={message.response.rooms} />
              )}
            </div>
          );
        })}
        {isLoading && <LoadingBubble />}
        {error && <ErrorState message={error.message} onRetry={handleRetry} disabled={isLoading} />}
      </div>

      <form
        onSubmit={handleFormSubmit}
        className="flex gap-2 border-t border-zinc-200 p-3 dark:border-zinc-800"
      >
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleInputKeyDown}
          placeholder="Ask a question..."
          className="min-w-0 flex-1 rounded-full border border-zinc-300 bg-white px-4 py-2 text-base sm:text-sm text-zinc-900 outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
          disabled={isLoading}
        />
        <button
          type="submit"
          disabled={isLoading || input.trim().length === 0}
          className="shrink-0 rounded-full bg-zinc-900 px-5 py-2 text-sm font-medium text-white disabled:opacity-40 dark:bg-zinc-100 dark:text-black"
        >
          Send
        </button>
      </form>
    </div>
  );
}
