import { v4 as uuidv4 } from 'uuid';
import { NotionClient } from './notion-client.js';
import { ChangeDetector } from './change-detector.js';
import { RelevanceFilter } from './relevance-filter.js';
import { CardGenerator } from './card-generator.js';
import { SRSDatabase } from './db.js';
import { ReviewPage } from './review-page.js';
import { createNewFSRSCard, gradeCard } from './scheduler.js';
import type { SRSCard } from './types.js';

const NOTION_API_KEY = process.env.NOTION_API_KEY!;
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY!;
const REVIEW_PAGE_ID = process.env.REVIEW_PAGE_ID!;
const POLL_INTERVAL_MINUTES = parseInt(process.env.POLL_INTERVAL_MINUTES ?? '1', 10);
const SQLITE_DB_PATH = process.env.SQLITE_DB_PATH ?? './data/srs.db';
const NOTION_RATE_LIMIT_RPS = parseInt(process.env.NOTION_RATE_LIMIT_RPS ?? '3', 10);

if (!NOTION_API_KEY || !ANTHROPIC_API_KEY || !REVIEW_PAGE_ID) {
  console.error('Missing required env vars: NOTION_API_KEY, ANTHROPIC_API_KEY, REVIEW_PAGE_ID');
  process.exit(1);
}

const notion = new NotionClient(NOTION_API_KEY, NOTION_RATE_LIMIT_RPS);
const changeDetector = new ChangeDetector();
const relevanceFilter = new RelevanceFilter(ANTHROPIC_API_KEY);
const cardGenerator = new CardGenerator(ANTHROPIC_API_KEY);
const db = new SRSDatabase(SQLITE_DB_PATH);
const reviewPage = new ReviewPage(notion, REVIEW_PAGE_ID);

async function contentPoll(): Promise<void> {
  console.log(`[content-poll] Checking for recently edited pages...`);

  try {
    const pages = await notion.searchRecentlyEditedPages(POLL_INTERVAL_MINUTES);
    const changedPages = changeDetector.getChangedPages(pages);

    if (changedPages.length === 0) {
      console.log('[content-poll] No changed pages.');
      return;
    }

    console.log(`[content-poll] Processing ${changedPages.length} changed page(s)...`);

    for (const page of changedPages) {
      // Skip the review page itself
      if (page.id.replace(/-/g, '') === REVIEW_PAGE_ID.replace(/-/g, '')) continue;

      try {
        console.log(`[content-poll] Processing page: ${page.title} (${page.id})`);
        const blocks = await notion.getPageBlocks(page.id);
        console.log(`[content-poll]   Found ${blocks.length} blocks`);

        const relevantBlocks = await relevanceFilter.filterBlocks(blocks);
        console.log(`[content-poll]   ${relevantBlocks.length} relevant blocks`);

        for (const block of relevantBlocks) {
          if (db.cardExistsForBlock(block.id)) {
            console.log(`[content-poll]   Block ${block.id} already has a card, skipping`);
            continue;
          }

          const generated = await cardGenerator.generateCard(block);
          if (!generated) continue;

          const fsrsFields = createNewFSRSCard();
          const card: SRSCard = {
            id: uuidv4(),
            source_page_id: page.id,
            source_block_id: block.id,
            question: generated.question,
            answer: generated.answer,
            due: fsrsFields.due!,
            stability: fsrsFields.stability!,
            difficulty: fsrsFields.difficulty!,
            elapsed_days: fsrsFields.elapsed_days!,
            scheduled_days: fsrsFields.scheduled_days!,
            reps: fsrsFields.reps!,
            lapses: fsrsFields.lapses!,
            state: fsrsFields.state!,
            last_review: fsrsFields.last_review ?? null,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          };

          db.insertCard(card);
          console.log(`[content-poll]   Created card: "${generated.question}"`);
        }
      } catch (err) {
        console.error(`[content-poll] Error processing page ${page.id}:`, err);
      }
    }

    changeDetector.markProcessed(changedPages);

    // Re-render review page after new cards
    const dueCards = db.getDueCards();
    await reviewPage.render(dueCards);
  } catch (err) {
    console.error('[content-poll] Error:', err);
  }
}

async function gradePoll(): Promise<void> {
  console.log(`[grade-poll] Checking review page for grades...`);

  try {
    const grades = await reviewPage.detectGrades();

    if (grades.size === 0) {
      console.log('[grade-poll] No grades found.');
      return;
    }

    console.log(`[grade-poll] Found ${grades.size} grade(s)`);

    for (const [cardId, grade] of grades) {
      const card = db.getCardById(cardId);
      if (!card) {
        console.warn(`[grade-poll] Card ${cardId} not found in DB`);
        continue;
      }

      const updatedFields = gradeCard(card, grade);
      const updatedCard: SRSCard = { ...card, ...updatedFields };
      db.updateCard(updatedCard);
      console.log(`[grade-poll] Updated card ${cardId} with grade ${grade}, next due: ${updatedFields.due}`);
    }

    // Re-render review page
    const dueCards = db.getDueCards();
    await reviewPage.render(dueCards);
  } catch (err) {
    console.error('[grade-poll] Error:', err);
  }
}

async function main(): Promise<void> {
  console.log(`SRS Review starting...`);
  console.log(`   Poll interval: ${POLL_INTERVAL_MINUTES} minute(s)`);
  console.log(`   Review page: ${REVIEW_PAGE_ID}`);
  console.log(`   DB: ${SQLITE_DB_PATH}`);

  // Initial render
  const dueCards = db.getDueCards();
  await reviewPage.render(dueCards);

  const intervalMs = POLL_INTERVAL_MINUTES * 60 * 1000;

  setInterval(contentPoll, intervalMs);
  setInterval(gradePoll, intervalMs);

  // Run immediately
  await contentPoll();
  await gradePoll();
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
