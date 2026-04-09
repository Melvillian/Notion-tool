import type { NotionPage } from './types.js';

export class ChangeDetector {
  private cache = new Map<string, string>(); // pageId -> lastEditedTime

  getChangedPages(pages: NotionPage[]): NotionPage[] {
    const changed: NotionPage[] = [];

    for (const page of pages) {
      const cached = this.cache.get(page.id);
      if (cached !== page.lastEditedTime) {
        changed.push(page);
      }
    }

    return changed;
  }

  markProcessed(pages: NotionPage[]): void {
    for (const page of pages) {
      this.cache.set(page.id, page.lastEditedTime);
    }
  }
}
