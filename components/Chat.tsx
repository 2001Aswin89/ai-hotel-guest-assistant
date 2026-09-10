'use client';

import { useState, type FormEvent, type KeyboardEvent } from 'react';
import type { ChatApiResponse, ChatMessage } from '@/lib/api-types';
import { sendChatMessage } from '@/lib/chat-client';

export interface UiMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  /** Full API response behind an assistant message — Step 7 uses `.type` to
   *  decide whether to render a clarify form / availability cards alongside the text. */
  response?: ChatApiResponse;
}

function toHistory(messages: UiMessage[]): ChatMessage[] {
  return messages.map((m) => ({ role: m.role, content: m.content }));
}

function MessageBubble({ message }: { message: UiMessage }) {
  const isUser = message.role === 'user';
  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[85%] rounded-2xl px-4 py-2 text-sm leading-relaxed whitespace-pre-wrap ${
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

  async function sendMessage() {
    const trimmed = input.trim();
    if (!trimmed || isLoading) return;

    const userMessage: UiMessage = { id: crypto.randomUUID(), role: 'user', content: trimmed };
    const historyForRequest = toHistory(messages);
    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      const response = await sendChatMessage({ message: trimmed, history: historyForRequest });
      const assistantMessage: UiMessage = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: response.reply,
        response,
      };
      setMessages((prev) => [...prev, assistantMessage]);
    } finally {
      setIsLoading(false);
    }
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

  return (
    <div className="flex h-full w-full max-w-2xl flex-1 flex-col overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
      <header className="border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
        <h1 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">
          Harborview Grand Hotel
        </h1>
        <p className="text-xs text-zinc-500 dark:text-zinc-400">Guest Assistant</p>
      </header>

      <div className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
        {messages.map((message) => (
          <MessageBubble key={message.id} message={message} />
        ))}
        {isLoading && <LoadingBubble />}
      </div>

      <form onSubmit={handleFormSubmit} className="flex gap-2 border-t border-zinc-200 p-3 dark:border-zinc-800">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleInputKeyDown}
          placeholder="Ask a question..."
          className="flex-1 rounded-full border border-zinc-300 bg-white px-4 py-2 text-sm text-zinc-900 outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
          disabled={isLoading}
        />
        <button
          type="submit"
          disabled={isLoading || input.trim().length === 0}
          className="rounded-full bg-zinc-900 px-5 py-2 text-sm font-medium text-white disabled:opacity-40 dark:bg-zinc-100 dark:text-black"
        >
          Send
        </button>
      </form>
    </div>
  );
}
