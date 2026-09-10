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
  private readonly client: GoogleGenAI;
  private readonly model: string;

  constructor(apiKey: string | undefined = process.env.GOOGLE_GEMINI_API_KEY, model: string = process.env.GEMINI_MODEL ?? DEFAULT_MODEL) {
    if (!apiKey) {
      throw new Error('GOOGLE_GEMINI_API_KEY is not set');
    }
    this.client = new GoogleGenAI({ apiKey });
    this.model = model;
  }

  async generate(prompt: string, context: string): Promise<string> {
    const response = await this.client.models.generateContent({
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
