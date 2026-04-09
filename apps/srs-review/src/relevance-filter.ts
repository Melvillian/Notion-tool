import Anthropic from '@anthropic-ai/sdk';
import type { NotionBlock, RelevanceResult } from './types.js';

export class RelevanceFilter {
  private client: Anthropic;

  constructor(apiKey: string) {
    this.client = new Anthropic({ apiKey });
  }

  async filterBlocks(blocks: NotionBlock[]): Promise<NotionBlock[]> {
    if (blocks.length === 0) return [];

    // Batch blocks into groups of 20 to reduce API calls
    const batchSize = 20;
    const relevantBlocks: NotionBlock[] = [];

    for (let i = 0; i < blocks.length; i += batchSize) {
      const batch = blocks.slice(i, i + batchSize);
      const results = await this.classifyBatch(batch);
      for (let j = 0; j < batch.length; j++) {
        if (results[j]?.isPolitical && results[j]?.isFactualClaim) {
          relevantBlocks.push(batch[j]);
        }
      }
    }

    return relevantBlocks;
  }

  private async classifyBatch(blocks: NotionBlock[]): Promise<RelevanceResult[]> {
    const numbered = blocks
      .map((b, i) => `${i + 1}. "${b.plainText}"`)
      .join('\n');

    try {
      const response = await this.client.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 256,
        output_config: {
          format: {
            type: 'json_schema',
            schema: {
              type: 'object',
              properties: {
                results: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      isPolitical: { type: 'boolean' },
                      isFactualClaim: { type: 'boolean' },
                    },
                    required: ['isPolitical', 'isFactualClaim'],
                  },
                },
              },
              required: ['results'],
            },
          },
        },
        messages: [{
          role: 'user',
          content: `For each of the following numbered text blocks, determine: Is this notion content related to politics, Yes or No? And if Yes, is this a fact or claim that describes some facet of the world, Yes or No? I am not interested in opinions or idle thoughts, I want you to only classify text that contains statements that are useful for someone to try committing to long term memory.

Blocks:
${numbered}

Respond with JSON: { "results": [{ "isPolitical": boolean, "isFactualClaim": boolean }, ...] } — one entry per block in order.`,
        }],
      });

      const text = response.content.find((b) => b.type === 'text')?.text ?? '{}';
      const parsed = JSON.parse(text);
      return parsed.results ?? blocks.map(() => ({ isPolitical: false, isFactualClaim: false }));
    } catch (err) {
      console.error('Relevance filter error:', err);
      return blocks.map(() => ({ isPolitical: false, isFactualClaim: false }));
    }
  }
}
