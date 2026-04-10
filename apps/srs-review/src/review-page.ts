import type { NotionClient } from './notion-client.js';
import type { SRSCard, UserGrade } from './types.js';
import type { BlockObjectResponse } from '@notionhq/client/build/src/api-endpoints';

const CARD_ID_REGEX = /\[id:([a-f0-9-]+)\]/;

export class ReviewPage {
  private renderLock: Promise<void> = Promise.resolve();

  constructor(
    private notion: NotionClient,
    private pageId: string,
  ) {}

  async render(dueCards: SRSCard[]): Promise<void> {
    // Serialize concurrent render calls to avoid archived-block conflicts
    const prev = this.renderLock;
    let resolve: () => void;
    this.renderLock = new Promise<void>(r => { resolve = r; });
    await prev;
    try {
      await this._render(dueCards);
    } finally {
      resolve!();
    }
  }

  private async _render(dueCards: SRSCard[]): Promise<void> {
    console.log(`Rendering review page with ${dueCards.length} due cards...`);
    await this.notion.deleteAllPageChildren(this.pageId);

    if (dueCards.length === 0) {
      await this.notion.appendChildren(this.pageId, [
        {
          object: 'block',
          type: 'paragraph',
          paragraph: {
            rich_text: [{
              type: 'text',
              text: { content: "You're all caught up on review, nice job! Come back later." },
            }],
          },
        },
      ]);
      return;
    }

    const blocks: any[] = [];
    for (let i = 0; i < dueCards.length; i++) {
      const card = dueCards[i];
      blocks.push(
        {
          object: 'block',
          type: 'divider',
          divider: {},
        },
        {
          object: 'block',
          type: 'heading_3',
          heading_3: {
            rich_text: [{
              type: 'text',
              text: { content: `Card ${i + 1} [id:${card.id}]` },
            }],
          },
        },
        {
          object: 'block',
          type: 'paragraph',
          paragraph: {
            rich_text: [{
              type: 'text',
              text: { content: `Q: ${card.question}` },
            }],
          },
        },
        {
          object: 'block',
          type: 'toggle',
          toggle: {
            rich_text: [{ type: 'text', text: { content: 'Show Answer' } }],
            children: [{
              object: 'block',
              type: 'paragraph',
              paragraph: {
                rich_text: [{ type: 'text', text: { content: `A: ${card.answer}` } }],
              },
            }],
          },
        },
        {
          object: 'block',
          type: 'paragraph',
          paragraph: {
            rich_text: [{ type: 'text', text: { content: 'Grade:' } }],
          },
        },
        {
          object: 'block',
          type: 'to_do',
          to_do: {
            rich_text: [{ type: 'text', text: { content: 'Hard' } }],
            checked: false,
          },
        },
        {
          object: 'block',
          type: 'to_do',
          to_do: {
            rich_text: [{ type: 'text', text: { content: 'Good' } }],
            checked: false,
          },
        },
        {
          object: 'block',
          type: 'to_do',
          to_do: {
            rich_text: [{ type: 'text', text: { content: 'Easy' } }],
            checked: false,
          },
        },
      );
    }

    await this.notion.appendChildren(this.pageId, blocks);
  }

  async detectGrades(): Promise<Map<string, UserGrade>> {
    const grades = new Map<string, UserGrade>();
    const children = await this.notion.getPageChildren(this.pageId);

    let currentCardId: string | null = null;
    const checkedGrades: string[] = [];

    for (const block of children) {
      if (block.type === 'heading_3') {
        // Save previous card's grades
        if (currentCardId && checkedGrades.length > 0) {
          const grade = resolveGrade(checkedGrades);
          if (grade) grades.set(currentCardId, grade);
          checkedGrades.length = 0;
        }

        const text = extractPlainText(block);
        const match = CARD_ID_REGEX.exec(text);
        currentCardId = match ? match[1] : null;
      } else if (block.type === 'to_do' && currentCardId) {
        const todo = (block as any).to_do;
        if (todo?.checked) {
          const label = extractPlainText(block).trim();
          if (['Hard', 'Good', 'Easy'].includes(label)) {
            checkedGrades.push(label);
          }
        }
      }
    }

    // Final card
    if (currentCardId && checkedGrades.length > 0) {
      const grade = resolveGrade(checkedGrades);
      if (grade) grades.set(currentCardId, grade);
    }

    return grades;
  }
}

function resolveGrade(grades: string[]): UserGrade | null {
  // Use highest: Easy > Good > Hard
  if (grades.includes('Easy')) return 'Easy';
  if (grades.includes('Good')) return 'Good';
  if (grades.includes('Hard')) return 'Hard';
  return null;
}

function extractPlainText(block: BlockObjectResponse): string {
  const typeObj = (block as any)[block.type];
  if (!typeObj?.rich_text) return '';
  return typeObj.rich_text.map((rt: any) => rt.plain_text).join('');
}
