import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import Chat from './Chat';
import { sendChatMessage } from '@/lib/chat-client';
import type { ChatApiResponse } from '@/lib/api-types';

vi.mock('@/lib/chat-client', () => ({
  sendChatMessage: vi.fn(),
}));

const mockedSend = vi.mocked(sendChatMessage);

function typeAndSubmit(text: string) {
  const input = screen.getByPlaceholderText('Ask a question...');
  fireEvent.change(input, { target: { value: text } });
  fireEvent.click(screen.getByRole('button', { name: 'Send' }));
}

beforeEach(() => {
  mockedSend.mockReset();
});

describe('Chat — F1 loading state', () => {
  it('shows a loading indicator while waiting, then hides it once the response arrives', async () => {
    let resolveResponse!: (value: ChatApiResponse) => void;
    mockedSend.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveResponse = resolve;
        }),
    );

    render(<Chat />);
    typeAndSubmit('what time is check-in?');

    expect(await screen.findByTestId('loading-indicator')).toBeInTheDocument();

    resolveResponse({ requestId: 'r1', type: 'answer', reply: 'Check-in is at 2 PM.' });

    await waitFor(() => expect(screen.queryByTestId('loading-indicator')).not.toBeInTheDocument());
    expect(await screen.findByText('Check-in is at 2 PM.')).toBeInTheDocument();
  });
});

describe('Chat — F2 error state', () => {
  it('shows an inline error with retry on failure, and retry resends without duplicating the message', async () => {
    mockedSend.mockRejectedValueOnce(new Error('Could not reach the server. Please check your connection and try again.'));

    render(<Chat />);
    typeAndSubmit('is breakfast included?');

    expect(
      await screen.findByText('Could not reach the server. Please check your connection and try again.'),
    ).toBeInTheDocument();
    expect(screen.getAllByText('is breakfast included?')).toHaveLength(1);

    mockedSend.mockResolvedValueOnce({ requestId: 'r2', type: 'answer', reply: 'Yes, breakfast is included.' });
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));

    expect(await screen.findByText('Yes, breakfast is included.')).toBeInTheDocument();
    // Still only one copy of the original user message — retry didn't duplicate it.
    expect(screen.getAllByText('is breakfast included?')).toHaveLength(1);
    expect(mockedSend).toHaveBeenCalledTimes(2);
  });
});

describe('Chat — F3 end-to-end flow (mocked backend)', () => {
  it('drives a question, then an availability clarify + results round trip', async () => {
    render(<Chat />);

    // 1. A normal knowledge question.
    mockedSend.mockResolvedValueOnce({
      requestId: 'r1',
      type: 'answer',
      reply: 'Yes, we have a pool.',
    });
    typeAndSubmit('do you have a pool?');
    expect(await screen.findByText('Yes, we have a pool.')).toBeInTheDocument();

    // 2. An availability question missing dates -> clarify form appears.
    mockedSend.mockResolvedValueOnce({
      requestId: 'r2',
      type: 'clarify',
      reply: 'Could you tell me the check-in and check-out dates?',
      missing: ['checkIn', 'checkOut'],
      partial: { adults: 2 },
    });
    typeAndSubmit('rooms available for 2 adults?');
    expect(await screen.findByText('Could you tell me the check-in and check-out dates?')).toBeInTheDocument();

    const [checkInInput, checkOutInput] = screen.getAllByDisplayValue('');
    fireEvent.change(checkInInput, { target: { value: '2026-09-15' } });
    fireEvent.change(checkOutInput, { target: { value: '2026-09-18' } });

    // 3. Submitting the form -> availability results render as cards.
    mockedSend.mockResolvedValueOnce({
      requestId: 'r3',
      type: 'availability_result',
      reply: "Here's what's available.",
      query: { checkIn: '2026-09-15', checkOut: '2026-09-18', adults: 2 },
      rooms: [{ roomType: 'Standard Room', price: 4500, capacity: 2, available: true }],
    });
    fireEvent.click(screen.getByRole('button', { name: 'Check availability' }));

    expect(await screen.findByText('Standard Room')).toBeInTheDocument();
    expect(screen.getByText('Available')).toBeInTheDocument();
    expect(mockedSend).toHaveBeenCalledTimes(3);

    // The 3rd call carried the merged partial (adults) + newly entered dates.
    const thirdCallPayload = mockedSend.mock.calls[2][0];
    expect(thirdCallPayload.availabilityParams).toEqual({
      checkIn: '2026-09-15',
      checkOut: '2026-09-18',
      adults: 2,
    });
  });
});
