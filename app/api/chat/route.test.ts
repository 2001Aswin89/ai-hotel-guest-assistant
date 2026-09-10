// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { POST } from './route';

function postRequest(body: unknown): Request {
  return new Request('http://localhost/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('POST /api/chat (end-to-end route handler)', () => {
  // B11 — a full, realistic request through the actual exported handler
  // (validation -> ChatOrchestrator -> JSON response), asserting the exact
  // ChatApiResponse shape from the contract (dev plan §3). Uses the
  // availability path deliberately: it's fully deterministic, so this test
  // doesn't need a real Gemini API key to be a genuine end-to-end check.
  it('returns a fully-shaped availability_result for a complete request', async () => {
    const res = await POST(
      postRequest({
        message: 'do you have rooms available from 2026-09-15 to 2026-09-18 for 2 adults',
        history: [],
      }),
    );

    expect(res.status).toBe(200);
    const json = await res.json();

    expect(json).toMatchObject({
      type: 'availability_result',
      query: { checkIn: '2026-09-15', checkOut: '2026-09-18', adults: 2 },
    });
    expect(typeof json.requestId).toBe('string');
    expect(Array.isArray(json.rooms)).toBe(true);
    expect(json.rooms.length).toBeGreaterThan(0);
    for (const room of json.rooms) {
      expect(typeof room.roomType).toBe('string');
      expect(typeof room.price).toBe('number');
      expect(typeof room.capacity).toBe('number');
      expect(typeof room.available).toBe('boolean');
    }
  });

  it('returns a 400 validation error for a malformed request', async () => {
    const res = await POST(postRequest({ history: [] }));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.type).toBe('error');
    expect(json.code).toBe('VALIDATION_ERROR');
    expect(typeof json.requestId).toBe('string');
  });

  it('returns a 400 for invalid JSON body instead of crashing', async () => {
    const req = new Request('http://localhost/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: 'not json',
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.type).toBe('error');
  });
});
