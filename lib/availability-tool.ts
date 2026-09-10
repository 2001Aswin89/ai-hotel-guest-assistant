import { KnowledgeBase } from '@/lib/knowledge-base';
import type { AvailabilityRoom } from '@/lib/api-types';

/**
 * Deterministic, LLM-free availability check (SRP — see dev plan §4).
 * This is intentionally NOT random per-call: the same (checkIn, checkOut, roomType)
 * always resolves to the same availability, so results are stable across a
 * conversation and reproducible in tests, while still varying by date/room.
 */
function stableHash(input: string): number {
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    hash = (hash * 31 + input.charCodeAt(i)) >>> 0;
  }
  return hash;
}

// Roughly 70% of capacity-eligible rooms come back available for a given date range.
const AVAILABILITY_THRESHOLD = 70;

export function checkAvailability(
  checkIn: string,
  checkOut: string,
  adults: number,
  knowledgeBase: KnowledgeBase = new KnowledgeBase(),
): AvailabilityRoom[] {
  const rooms = knowledgeBase.getRooms();

  return rooms
    .filter((room) => room.capacity >= adults)
    .map((room) => {
      const seed = `${checkIn}|${checkOut}|${room.type}`;
      const available = stableHash(seed) % 100 < AVAILABILITY_THRESHOLD;
      return {
        roomType: room.type,
        price: room.pricePerNight,
        capacity: room.capacity,
        available,
      };
    });
}
