import { GoogleGenAI } from '@google/genai';

/**
 * SRP + Liskov substitution (see dev plan §4): callers depend only on this
 * interface, never on the Gemini SDK directly, so a different provider could
 * be swapped in without touching ChatOrchestrator or the API route.
 */
export interface LlmProvider {
  generate(prompt: string, context: string): Promise<string>;
}

const DEFAULT_MODEL = 'gemini-2.5-flash';

export class GeminiProvider implements LlmProvider {
  private readonly apiKey: string | undefined;
  private readonly model: string;
  private client: GoogleGenAI | undefined;

  // Deliberately does NOT throw here: the availability/clarify paths never
  // call generate() at all, so a missing key shouldn't break those requests.
  // The key is only required — and only checked — once generate() actually runs.
  constructor(apiKey: string | undefined = process.env.GOOGLE_GEMINI_API_KEY, model: string = process.env.GEMINI_MODEL ?? DEFAULT_MODEL) {
    this.apiKey = apiKey;
    this.model = model;
  }

  private getClient(): GoogleGenAI {
    if (!this.apiKey) {
      throw new Error('GOOGLE_GEMINI_API_KEY is not set');
    }
    if (!this.client) {
      this.client = new GoogleGenAI({ apiKey: this.apiKey });
    }
    return this.client;
  }

  async generate(prompt: string, context: string): Promise<string> {
    const response = await this.getClient().models.generateContent({
      model: this.model,
      contents: prompt,
      config: {
        systemInstruction: context,
      },
    });

    const text = response.text;
    if (!text) {
      throw new Error('Gemini returned an empty response');
    }
    return text;
  }
}
