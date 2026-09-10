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
// NOTE: word-stem alternatives (availab/vacan) deliberately have NO trailing \b right after
// the stem — "available"/"availability" continue with more letters, so a \b there would never
// match (this was a real bug: it silently never matched "availab" and relied on other phrasings
// like "do you have rooms" to catch availability questions at all).
const AVAILABILITY_KEYWORDS =
  /\b(availab\w*|vacan\w*|book(?:ing)?|reserve|reservation|any rooms?|free rooms?|do you have (?:a |any )?rooms?|rooms? for)\b/i;

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
    const isAvailabilityText = AVAILABILITY_KEYWORDS.test(message);
    const hasExplicitParams =
      explicitParams &&
      (explicitParams.checkIn || explicitParams.checkOut || explicitParams.adults !== undefined);

    if (!isAvailabilityText && !hasExplicitParams) {
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
