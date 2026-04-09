import { NotionClient } from './notion-client.js';
import { ChangeDetector } from './change-detector.js';
import { RelevanceFilter } from './relevance-filter.js';
import { ClaimExtractor } from './claim-extractor.js';
import { NotionAnnotator } from './notion-annotator.js';

const NOTION_API_KEY = process.env.NOTION_API_KEY!;
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY!;
const POLL_INTERVAL_MINUTES = parseInt(process.env.POLL_INTERVAL_MINUTES ?? '1', 10);
const NOTION_RATE_LIMIT_RPS = parseInt(process.env.NOTION_RATE_LIMIT_RPS ?? '3', 10);

if (!NOTION_API_KEY || !ANTHROPIC_API_KEY) {
  console.error('Missing required env vars: NOTION_API_KEY, ANTHROPIC_API_KEY');
  process.exit(1);
}

const notion = new NotionClient(NOTION_API_KEY, NOTION_RATE_LIMIT_RPS);
const changeDetector = new ChangeDetector();
const relevanceFilter = new RelevanceFilter(ANTHROPIC_API_KEY);
const claimExtractor = new ClaimExtractor(ANTHROPIC_API_KEY);
const annotator = new NotionAnnotator(notion);

async function contentPoll(): Promise<void> {
  console.log(`[plausibility-poll] Checking for recently edited pages...`);

  try {
    const pages = await notion.searchRecentlyEditedPages(POLL_INTERVAL_MINUTES);
    const changedPages = changeDetector.getChangedPages(pages);

    if (changedPages.length === 0) {
      console.log('[plausibility-poll] No changed pages.');
      return;
    }

    console.log(`[plausibility-poll] Processing ${changedPages.length} changed page(s)...`);

    for (const page of changedPages) {
      try {
        console.log(`[plausibility-poll] Processing page: ${page.title} (${page.id})`);
        const blocks = await notion.getPageBlocks(page.id);
        console.log(`[plausibility-poll]   Found ${blocks.length} blocks`);

        const relevantBlocks = await relevanceFilter.filterBlocks(blocks);
        console.log(`[plausibility-poll]   ${relevantBlocks.length} relevant blocks`);

        for (const block of relevantBlocks) {
          console.log(`[plausibility-poll]   Checking: "${block.plainText.slice(0, 80)}..."`);

          const result = await claimExtractor.extractAndCheck(block);
          if (!result) continue;

          const hasImplausible = result.claims.some((c) => c.tag === 'Implausible');

          if (hasImplausible) {
            const implausibleClaims = result.claims
              .filter((c) => c.tag === 'Implausible')
              .map((c) => c.claim_text);
            console.log(`[plausibility-poll]   IMPLAUSIBLE claims found: ${implausibleClaims.join('; ')}`);
            await annotator.colorBlockRed(block);
          } else {
            console.log(`[plausibility-poll]   All claims plausible/uncertain, no annotation needed`);
          }
        }
      } catch (err) {
        console.error(`[plausibility-poll] Error processing page ${page.id}:`, err);
      }
    }

    changeDetector.markProcessed(changedPages);
  } catch (err) {
    console.error('[plausibility-poll] Error:', err);
  }
}

async function main(): Promise<void> {
  console.log(`Plausibility Checker starting...`);
  console.log(`   Poll interval: ${POLL_INTERVAL_MINUTES} minute(s)`);

  const intervalMs = POLL_INTERVAL_MINUTES * 60 * 1000;
  setInterval(contentPoll, intervalMs);

  // Run immediately
  await contentPoll();
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
