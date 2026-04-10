import { Client, isFullBlock, isFullPage } from '@notionhq/client';
import type { BlockObjectResponse, PageObjectResponse } from '@notionhq/client/build/src/api-endpoints';
import type { NotionBlock, NotionPage, RichTextItem } from './types.js';

// Block types that contain rich_text
const SUPPORTED_BLOCK_TYPES = new Set([
  'paragraph',
  'heading_1',
  'heading_2',
  'heading_3',
  'bulleted_list_item',
  'numbered_list_item',
  'to_do',
  'toggle',
  'quote',
  'callout',
]);

class RateLimiter {
  private queue: Array<() => void> = [];
  private requestsThisSecond = 0;
  private windowStart = Date.now();
  private readonly maxRps: number;

  constructor(maxRps: number = 3) {
    this.maxRps = maxRps;
  }

  async throttle(): Promise<void> {
    return new Promise((resolve) => {
      this.queue.push(resolve);
      this.processQueue();
    });
  }

  private processQueue() {
    const now = Date.now();
    if (now - this.windowStart >= 1000) {
      this.windowStart = now;
      this.requestsThisSecond = 0;
    }

    while (this.queue.length > 0 && this.requestsThisSecond < this.maxRps) {
      const next = this.queue.shift()!;
      this.requestsThisSecond++;
      next();
    }

    if (this.queue.length > 0) {
      const delay = 1000 - (Date.now() - this.windowStart);
      setTimeout(() => this.processQueue(), Math.max(delay, 0));
    }
  }
}

export class NotionClient {
  private client: Client;
  private limiter: RateLimiter;

  constructor(apiKey: string, rateLimit: number = 3) {
    this.client = new Client({ auth: apiKey });
    this.limiter = new RateLimiter(rateLimit);
  }

  private async callWithRetry<T>(fn: () => Promise<T>): Promise<T> {
    let delay = 1000;
    for (let attempt = 0; attempt < 5; attempt++) {
      try {
        await this.limiter.throttle();
        return await fn();
      } catch (err: any) {
        if (err?.status === 429) {
          const retryAfter = parseInt(err?.headers?.['retry-after'] ?? '1', 10) * 1000;
          await sleep(Math.min(retryAfter * Math.pow(2, attempt), 60000));
          delay = Math.min(delay * 2, 60000);
        } else if (err?.status >= 500) {
          await sleep(delay);
          delay = Math.min(delay * 2, 60000);
        } else {
          throw err;
        }
      }
    }
    throw new Error('Max retries exceeded');
  }

  async searchRecentlyEditedPages(sinceMinutes: number): Promise<NotionPage[]> {
    const sinceTime = new Date(Date.now() - sinceMinutes * 60 * 1000).toISOString();
    const pages: NotionPage[] = [];
    let cursor: string | undefined;

    do {
      const response = await this.callWithRetry(() =>
        this.client.search({
          filter: { property: 'object', value: 'page' },
          sort: { direction: 'descending', timestamp: 'last_edited_time' },
          start_cursor: cursor,
          page_size: 100,
        })
      );

      for (const result of response.results) {
        if (!isFullPage(result)) continue;
        if (result.last_edited_time < sinceTime) break;

        const title = extractTitle(result);
        pages.push({
          id: result.id,
          lastEditedTime: result.last_edited_time,
          title,
        });
      }

      cursor = response.has_more ? (response.next_cursor ?? undefined) : undefined;
    } while (cursor);

    return pages;
  }

  async getPageBlocks(pageId: string): Promise<NotionBlock[]> {
    const blocks: NotionBlock[] = [];
    await this.fetchBlockChildren(pageId, blocks);
    return blocks;
  }

  private async fetchBlockChildren(blockId: string, acc: NotionBlock[]): Promise<void> {
    let cursor: string | undefined;

    do {
      const response = await this.callWithRetry(() =>
        this.client.blocks.children.list({
          block_id: blockId,
          start_cursor: cursor,
          page_size: 100,
        })
      );

      for (const block of response.results) {
        if (!isFullBlock(block)) continue;
        const notionBlock = extractBlockText(block);
        if (notionBlock) {
          acc.push(notionBlock);
        }
        if (block.has_children && SUPPORTED_BLOCK_TYPES.has(block.type)) {
          await this.fetchBlockChildren(block.id, acc);
        }
      }

      cursor = response.has_more ? (response.next_cursor ?? undefined) : undefined;
    } while (cursor);
  }

  async updateBlockColor(blockId: string, richText: RichTextItem[]): Promise<void> {
    await this.callWithRetry(() =>
      this.client.blocks.update({
        block_id: blockId,
        // @ts-ignore — dynamic block type update
        paragraph: {
          rich_text: richText.map((rt) => ({
            ...rt,
            annotations: { ...rt.annotations, color: 'red_background' },
          })),
        },
      })
    );
  }

  async getBlock(blockId: string): Promise<BlockObjectResponse | null> {
    try {
      const block = await this.callWithRetry(() =>
        this.client.blocks.retrieve({ block_id: blockId })
      );
      if (isFullBlock(block)) return block;
      return null;
    } catch {
      return null;
    }
  }

  async deleteAllPageChildren(pageId: string): Promise<void> {
    let cursor: string | undefined;
    do {
      const response = await this.callWithRetry(() =>
        this.client.blocks.children.list({ block_id: pageId, start_cursor: cursor, page_size: 100 })
      );
      for (const block of response.results) {
        if ('archived' in block && block.archived) continue;
        await this.callWithRetry(() =>
          this.client.blocks.delete({ block_id: block.id })
        );
      }
      cursor = response.has_more ? (response.next_cursor ?? undefined) : undefined;
    } while (cursor);
  }

  async appendChildren(pageId: string, children: any[]): Promise<void> {
    // Batch into groups of 100
    for (let i = 0; i < children.length; i += 100) {
      const batch = children.slice(i, i + 100);
      await this.callWithRetry(() =>
        this.client.blocks.children.append({ block_id: pageId, children: batch })
      );
    }
  }

  async getPageChildren(pageId: string): Promise<BlockObjectResponse[]> {
    const blocks: BlockObjectResponse[] = [];
    let cursor: string | undefined;
    do {
      const response = await this.callWithRetry(() =>
        this.client.blocks.children.list({ block_id: pageId, start_cursor: cursor, page_size: 100 })
      );
      for (const block of response.results) {
        if (isFullBlock(block)) blocks.push(block);
      }
      cursor = response.has_more ? (response.next_cursor ?? undefined) : undefined;
    } while (cursor);
    return blocks;
  }
}

function extractTitle(page: PageObjectResponse): string {
  const titleProp = Object.values(page.properties).find(
    (p) => p.type === 'title'
  );
  if (titleProp?.type === 'title') {
    return titleProp.title.map((t) => t.plain_text).join('');
  }
  return 'Untitled';
}

function extractBlockText(block: BlockObjectResponse): NotionBlock | null {
  const type = block.type;
  if (!SUPPORTED_BLOCK_TYPES.has(type)) return null;

  const typeObj = (block as any)[type];
  if (!typeObj?.rich_text) return null;

  const richText: RichTextItem[] = typeObj.rich_text;
  const plainText = richText.map((rt: any) => rt.plain_text).join('');

  if (!plainText.trim()) return null;

  return {
    id: block.id,
    type,
    plainText,
    richText,
  };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
