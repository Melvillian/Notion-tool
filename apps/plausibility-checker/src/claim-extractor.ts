import Anthropic from '@anthropic-ai/sdk';
import type { NotionBlock, PlausibilityResult } from './types.js';

export class ClaimExtractor {
  private client: Anthropic;

  constructor(apiKey: string) {
    this.client = new Anthropic({ apiKey });
  }

  async extractAndCheck(block: NotionBlock): Promise<PlausibilityResult | null> {
    try {
      const response = await this.client.messages.create({
        model: 'claude-opus-4-6',
        max_tokens: 4096,
        tools: [{
          type: 'web_search_20260209' as any,
          name: 'web_search',
          max_uses: 10,
        }],
        output_config: {
          format: {
            type: 'json_schema',
            schema: {
              type: 'object',
              properties: {
                claims: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      claim_text: { type: 'string' },
                      tag: { type: 'string', enum: ['Plausible', 'Uncertain', 'Implausible'] },
                      evidence_summary: { type: 'string' },
                      sources: { type: 'array', items: { type: 'string' } },
                    },
                    required: ['claim_text', 'tag', 'evidence_summary', 'sources'],
                    additionalProperties: false,
                  },
                },
              },
              required: ['claims'],
              additionalProperties: false,
            },
          },
        },
        messages: [{
          role: 'user',
          content: `Extract all claims from this text, then for each of them check their plausibility by searching the Internet to find reliable sources that support or contradict the claim. Each claim should then be marked with 1 of 3 tags: Plausible, Uncertain, Implausible.

Text: "${block.plainText}"

Respond with JSON:
{
  "claims": [
    {
      "claim_text": "the extracted atomic claim",
      "tag": "Plausible" | "Uncertain" | "Implausible",
      "evidence_summary": "brief summary of supporting/contradicting evidence found",
      "sources": ["URLs of sources consulted"]
    }
  ]
}`,
        }],
      });

      const text = response.content.find((b) => b.type === 'text')?.text ?? '{}';
      const parsed = JSON.parse(text);
      return parsed as PlausibilityResult;
    } catch (err) {
      console.error('Claim extraction error:', err);
      return null;
    }
  }
}
