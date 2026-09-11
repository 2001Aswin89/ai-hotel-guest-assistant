'use client';

import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
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
        className={`max-w-[88%] rounded-2xl px-4 py-2.5 text-[15px] leading-relaxed whitespace-pre-wrap break-words shadow-sm sm:max-w-[75%] ${
          isUser
            ? 'bg-teal-700 text-white dark:bg-teal-600'
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
    <div className="message-in flex justify-start" data-testid="loading-indicator">
      <div className="flex items-center gap-1 rounded-2xl bg-zinc-100 px-4 py-3 shadow-sm dark:bg-zinc-800">
        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-zinc-400 [animation-delay:-0.3s]" />
        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-zinc-400 [animation-delay:-0.15s]" />
        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-zinc-400" />
      </div>
    </div>
  );
}

function SendIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" aria-hidden="true">
      <path
        d="M12 19V5M12 5L5 12M12 5L19 12"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
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
  const scrollAnchorRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const isFirstRenderRef = useRef(true);

  // Keep the latest message/loading/error state in view as the conversation
  // grows, the way ChatGPT/Claude's web UI does — without this, a guest
  // would have to manually scroll down after every reply.
  useEffect(() => {
    scrollAnchorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages, isLoading, error]);

  // The input is disabled while a request is in flight, and a browser
  // forcibly blurs an element the instant it's disabled — so after sending
  // a message the guest would otherwise have to click back into the box to
  // type a follow-up. Restore focus once it's re-enabled (this effect only
  // runs after the DOM has actually committed disabled={false}). Skips the
  // very first render so the page doesn't auto-focus (and pop the mobile
  // keyboard) on initial load — only re-focuses after a real request.
  useEffect(() => {
    if (isFirstRenderRef.current) {
      isFirstRenderRef.current = false;
      return;
    }
    if (!isLoading) {
      inputRef.current?.focus();
    }
  }, [isLoading]);

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
    <div className="flex h-full w-full flex-col bg-white dark:bg-zinc-950">
      {/* Header — width now bounded by the panel in page.tsx, not by an
          internal max-width, so it always matches the panel edge-to-edge. */}
      <header className="shrink-0 border-b border-zinc-200/80 bg-white/85 backdrop-blur-sm dark:border-zinc-800/80 dark:bg-zinc-950/85">
        <div className="flex w-full items-center gap-3 px-4 py-3 sm:px-5">
          <div
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-teal-700 text-sm font-semibold text-white dark:bg-teal-500 dark:text-teal-950"
            aria-hidden="true"
          >
            H
          </div>
          <div className="min-w-0">
            <h1 className="font-display truncate text-base italic text-zinc-900 dark:text-zinc-50">
              Harborview Grand Hotel
            </h1>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">Guest Assistant</p>
          </div>
        </div>
      </header>

      {/* Scroll region fills whatever space is left between header and
          composer, at any window size/aspect ratio. */}
      <div className="chat-scroll min-h-0 flex-1 overflow-y-auto overflow-x-hidden">
        <div className="flex w-full flex-col gap-3 px-4 py-6 sm:px-5">
          {messages.map((message) => {
            // Only the most recent assistant message is still actionable — an
            // older clarify/availability turn shouldn't keep showing a live form.
            const isActionable = message.id === lastMessageId && !isLoading;

            return (
              <div key={message.id} className="message-in flex flex-col gap-2">
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
          <div ref={scrollAnchorRef} />
        </div>
      </div>

      {/* Composer — a single rounded input "capsule" like ChatGPT/Claude,
          rather than two separate pill controls. */}
      <div className="shrink-0 border-t border-zinc-200/80 bg-white/85 backdrop-blur-sm dark:border-zinc-800/80 dark:bg-zinc-950/85">
        <form onSubmit={handleFormSubmit} className="w-full px-4 py-3 sm:px-5">
          <div className="flex items-center gap-2 rounded-3xl border border-zinc-200 bg-zinc-50 py-1.5 pl-4 pr-1.5 shadow-sm transition-colors focus-within:border-teal-500 dark:border-zinc-800 dark:bg-zinc-900 dark:focus-within:border-teal-500">
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleInputKeyDown}
              placeholder="Ask a question..."
              className="min-w-0 flex-1 bg-transparent py-2 text-base text-zinc-900 outline-none placeholder:text-zinc-400 dark:text-zinc-100 dark:placeholder:text-zinc-500 sm:text-sm"
              disabled={isLoading}
            />
            <button
              type="submit"
              disabled={isLoading || input.trim().length === 0}
              aria-label="Send message"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-teal-700 text-white transition-transform disabled:opacity-30 disabled:pointer-events-none enabled:hover:scale-105 dark:bg-teal-500 dark:text-teal-950"
            >
              <SendIcon />
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
