# notion-tool

## Overview

Bun monorepo with two Notion-integrated apps that poll for page changes and process them using Claude (Anthropic API).

## Scripts

- `bun run srs-review` — Run the SRS review app
- `bun run plausibility-checker` — Run the plausibility checker app

## Workspaces

- `apps/srs-review` — Spaced-repetition flashcard generator from Notion content
- `apps/plausibility-checker` — Fact-checking annotator for Notion pages

## Environment

See `.env.example`. Requires `NOTION_API_KEY`, `ANTHROPIC_API_KEY`. SRS review also needs `REVIEW_PAGE_ID`.

## Auto-Update Instructions

After changes to files in this directory or subdirectories, run `/update-claude-md`
to keep this documentation synchronized with the codebase.
