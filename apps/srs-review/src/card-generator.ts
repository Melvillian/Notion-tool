import Anthropic from '@anthropic-ai/sdk';
import type { NotionBlock, CardGenerationResult } from './types.js';

export class CardGenerator {
  private client: Anthropic;

  constructor(apiKey: string) {
    this.client = new Anthropic({ apiKey });
  }

  async generateCard(block: NotionBlock): Promise<CardGenerationResult | null> {
    try {
      const response = await this.client.messages.create({
        model: 'claude-opus-4-6',
        max_tokens: 1024,
        output_config: {
          format: {
            type: 'json_schema',
            schema: {
              type: 'object',
              properties: {
                question: { type: 'string' },
                answer: { type: 'string' },
              },
              required: ['question', 'answer'],
              additionalProperties: false,
            },
          },
        },
        messages: [{
          role: 'user',
          content: `Given a text statement, generate a question & answer flashcard, similar to an Anki SRS card, that I can use in my spaced repetition software.

Statement: "${block.plainText}"

Respond with JSON:
{
  "question": "a clear, specific question that tests recall of the key fact",
  "answer": "a concise, accurate answer"
}`,
        }],
      });

      const text = response.content.find((b) => b.type === 'text')?.text ?? '{}';
      const parsed = JSON.parse(text);
      if (!parsed.question || !parsed.answer) return null;
      return parsed as CardGenerationResult;
    } catch (err) {
      console.error('Card generation error:', err);
      return null;
    }
  }
}
