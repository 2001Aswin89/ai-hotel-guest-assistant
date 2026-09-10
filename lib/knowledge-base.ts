import hotelKbData from '@/data/hotel-kb.json';

export interface Amenity {
  name: string;
  description: string;
}

export interface RoomType {
  type: string;
  capacity: number;
  pricePerNight: number;
  description: string;
}

export interface CancellationPolicy {
  summary: string;
  details: string;
}

export interface Faq {
  question: string;
  answer: string;
}

export interface Policies {
  checkInTime: string;
  checkOutTime: string;
  cancellationPolicy: CancellationPolicy;
}

export interface HotelKnowledgeBaseData {
  hotelName: string;
  checkInTime: string;
  checkOutTime: string;
  amenities: Amenity[];
  rooms: RoomType[];
  cancellationPolicy: CancellationPolicy;
  faqs: Faq[];
}

/**
 * Narrow, read-only access to the hotel knowledge base.
 * SRP: this class only loads/queries KB data — it knows nothing about the LLM,
 * availability logic, or HTTP. See requirements/hotel-guest-assistant-dev-plan.md §4.
 */
export class KnowledgeBase {
  private readonly data: HotelKnowledgeBaseData;

  constructor(data: HotelKnowledgeBaseData = hotelKbData as HotelKnowledgeBaseData) {
    this.data = data;
  }

  getHotelName(): string {
    return this.data.hotelName;
  }

  getPolicies(): Policies {
    return {
      checkInTime: this.data.checkInTime,
      checkOutTime: this.data.checkOutTime,
      cancellationPolicy: this.data.cancellationPolicy,
    };
  }

  getRooms(): RoomType[] {
    return this.data.rooms;
  }

  getAmenities(): Amenity[] {
    return this.data.amenities;
  }

  getFaqs(): Faq[] {
    return this.data.faqs;
  }

  /**
   * Flattens the whole knowledge base into a single text block suitable for
   * grounding an LLM prompt (see Step 3 of the dev plan).
   */
  getFullContextText(): string {
    const { hotelName, checkInTime, checkOutTime, cancellationPolicy, amenities, rooms, faqs } =
      this.data;

    const amenitiesText = amenities.map((a) => `- ${a.name}: ${a.description}`).join('\n');

    const roomsText = rooms
      .map(
        (r) =>
          `- ${r.type}: capacity ${r.capacity} guests, ₹${r.pricePerNight}/night. ${r.description}`,
      )
      .join('\n');

    const faqsText = faqs.map((f) => `Q: ${f.question}\nA: ${f.answer}`).join('\n\n');

    return [
      `Hotel: ${hotelName}`,
      '',
      `Check-in time: ${checkInTime}`,
      `Check-out time: ${checkOutTime}`,
      '',
      'Cancellation policy:',
      cancellationPolicy.summary,
      cancellationPolicy.details,
      '',
      'Amenities:',
      amenitiesText,
      '',
      'Room types:',
      roomsText,
      '',
      'Frequently asked questions:',
      faqsText,
    ].join('\n');
  }
}
