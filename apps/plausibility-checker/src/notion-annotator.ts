import type { NotionClient } from './notion-client.js';
import type { NotionBlock } from './types.js';

export class NotionAnnotator {
  constructor(private notion: NotionClient) {}

  async colorBlockRed(block: NotionBlock): Promise<void> {
    try {
      // Fetch current block state
      const currentBlock = await this.notion.getBlock(block.id);
      if (!currentBlock) {
        console.warn(`Block ${block.id} not found, skipping annotation`);
        return;
      }

      const typeObj = (currentBlock as any)[currentBlock.type];
      if (!typeObj?.rich_text) {
        console.warn(`Block ${block.id} type ${currentBlock.type} has no rich_text`);
        return;
      }

      // Clone rich_text and set color to red_background on all segments
      const updatedRichText = typeObj.rich_text.map((rt: any) => ({
        ...rt,
        annotations: {
          ...(rt.annotations ?? {}),
          color: 'red_background',
        },
      }));

      await this.notion.updateBlockColor(block.id, updatedRichText);
      console.log(`[annotator] Colored block ${block.id} red`);
    } catch (err) {
      console.error(`[annotator] Error coloring block ${block.id}:`, err);
    }
  }
}
