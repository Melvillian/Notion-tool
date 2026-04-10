# srs-review

## Overview

TypeScript app that polls Notion for changed pages, generates spaced-repetition flashcards using Claude, and manages review scheduling via FSRS algorithm. Stores card state in SQLite.

## Commands

- `bun run start` — Run the app
- `bun run dev` — Run with watch mode

## Dependencies

<!-- AUTO-GENERATED - DO NOT EDIT -->
- **@anthropic-ai/sdk** (^0.39.0) — Claude API client for card generation
- **@notionhq/client** (^2.2.15) — Notion API client for page polling
- **ts-fsrs** (^5.2.0) — Free Spaced Repetition Scheduler algorithm
- **uuid** (^9.0.0) — UUID generation for card IDs

## Key Modules

- `index.ts` — Entry point, polling loop
- `card-generator.ts` — Claude-powered flashcard generation
- `scheduler.ts` — FSRS-based review scheduling
- `db.ts` — SQLite persistence for SRS cards
- `review-page.ts` — Renders review UI in Notion
- `change-detector.ts` / `relevance-filter.ts` — Change detection and filtering

## Auto-Update Instructions

After changes to files in this directory or subdirectories, run `/update-claude-md`
to keep this documentation synchronized with the codebase.
