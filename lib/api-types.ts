/**
 * Chat API contract — decided up front (see requirements/hotel-guest-assistant-dev-plan.md §3)
 * so every step builds against the same shape instead of it being retrofitted later.
 */

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export type MissingAvailabilityField = 'checkIn' | 'checkOut' | 'adults';

export interface AvailabilityRoom {
  roomType: string;
  price: number;
  capacity: number;
  available: boolean;
}

export interface AvailabilityQuery {
  checkIn: string;
  checkOut: string;
  adults: number;
}

export interface ChatApiRequest {
  message: string;
  history: ChatMessage[];
  /**
   * Optional structured values from the availability date/guest picker
   * (Step 7 UI). When present, these are used directly instead of trying to
   * regex-parse dates back out of free text — more reliable, still fully
   * deterministic/LLM-free.
   */
  availabilityParams?: Partial<AvailabilityQuery>;
}

export type ChatApiErrorCode = 'VALIDATION_ERROR' | 'LLM_ERROR' | 'INTERNAL_ERROR';

/**
 * Every response carries a requestId (for tracing back to server logs) and a
 * `type` discriminant the frontend can switch on directly instead of parsing reply text.
 */
export type ChatApiResponse = { requestId: string } & (
  | { type: 'answer'; reply: string }
  | { type: 'clarify'; reply: string; missing: MissingAvailabilityField[] }
  | {
      type: 'availability_result';
      reply: string;
      query: AvailabilityQuery;
      rooms: AvailabilityRoom[];
    }
  | { type: 'error'; reply: string; code: ChatApiErrorCode }
);
