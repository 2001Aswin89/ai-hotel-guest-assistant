import type { AvailabilityQuery, MissingAvailabilityField } from '@/lib/api-types';

export interface AvailabilityIntent {
  intent: 'availability';
  params: Partial<AvailabilityQuery>;
  missing: MissingAvailabilityField[];
}

export interface KnowledgeIntent {
  intent: 'knowledge';
}

export type Intent = AvailabilityIntent | KnowledgeIntent;

// Keyword/pattern based on purpose (assignment explicitly says this doesn't need an LLM call).
//
// Phrasing that's unambiguous on its own — "vacancy", "do you have any
// rooms", etc. Always availability intent.
const STRONG_AVAILABILITY_PHRASES =
  /\b(vacan\w*|any rooms?|free rooms?|do you have (?:a |any )?rooms?|rooms? for)\b/i;

// "available"/"book"/"reserve" alone are too generic a signal — e.g. "is
// the spa available", "do you have go-karting available", "can I book a
// spa session" all use these words about something that isn't a room at
// all. A real guest question found exactly this bug live: "since you have
// a spa, is a complementary massage included?" and "do you have go
// carting available?" were both misrouted into the booking flow purely
// because they contained "available", and the deterministic
// checkAvailability() tool has no idea what "go carting" even means — it
// just returned room results regardless. So these verbs only count as
// availability intent when paired with an actual room/stay noun.
const AVAILABILITY_VERB = /\b(availab\w*|book(?:ing)?|reserve|reservation)\b/i;
const ROOM_CONTEXT = /\b(rooms?|suites?|stay|accommodation)\b/i;

function isAvailabilityText(message: string): boolean {
  if (STRONG_AVAILABILITY_PHRASES.test(message)) return true;
  return AVAILABILITY_VERB.test(message) && ROOM_CONTEXT.test(message);
}

const ISO_DATE = /\b(\d{4}-\d{2}-\d{2})\b/g;
const ADULTS_PATTERN = /\b(\d{1,2})\s*(adults?|guests?|people|persons?|pax)\b/i;

function extractDates(message: string): { checkIn?: string; checkOut?: string } {
  const matches = [...message.matchAll(ISO_DATE)].map((m) => m[1]);
  return { checkIn: matches[0], checkOut: matches[1] };
}

function extractAdults(message: string): number | undefined {
  const match = message.match(ADULTS_PATTERN);
  return match ? Number(match[1]) : undefined;
}

function missingFields(params: Partial<AvailabilityQuery>): MissingAvailabilityField[] {
  const missing: MissingAvailabilityField[] = [];
  if (!params.checkIn) missing.push('checkIn');
  if (!params.checkOut) missing.push('checkOut');
  if (params.adults === undefined || params.adults <= 0) missing.push('adults');
  return missing;
}

/**
 * SRP (dev plan §4): decides "is this an availability question or a knowledge
 * question", and if availability, what params are present vs. still missing.
 * `explicitParams` lets the Step 7 date/guest picker bypass free-text parsing entirely.
 */
export class IntentClassifier {
  classify(message: string, explicitParams?: Partial<AvailabilityQuery>): Intent {
    const hasExplicitParams =
      explicitParams &&
      (explicitParams.checkIn || explicitParams.checkOut || explicitParams.adults !== undefined);

    if (!isAvailabilityText(message) && !hasExplicitParams) {
      return { intent: 'knowledge' };
    }

    const { checkIn, checkOut } = extractDates(message);
    const adults = extractAdults(message);

    const params: Partial<AvailabilityQuery> = {
      checkIn: explicitParams?.checkIn ?? checkIn,
      checkOut: explicitParams?.checkOut ?? checkOut,
      adults: explicitParams?.adults ?? adults,
    };

    return { intent: 'availability', params, missing: missingFields(params) };
  }
}
