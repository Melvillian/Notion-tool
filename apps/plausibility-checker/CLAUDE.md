# plausibility-checker

## Overview

TypeScript app that polls Notion for changed pages, extracts factual claims using Claude, checks their plausibility, and annotates the Notion page with results.

## Commands

- `bun run start` — Run the app
- `bun run dev` — Run with watch mode

## Dependencies

<!-- AUTO-GENERATED - DO NOT EDIT -->
- **@anthropic-ai/sdk** (^0.39.0) — Claude API client for claim extraction
- **@notionhq/client** (^2.2.15) — Notion API client for page polling

## Key Modules

- `index.ts` — Entry point, polling loop
- `claim-extractor.ts` — Claude-powered factual claim extraction
- `notion-annotator.ts` — Writes plausibility annotations back to Notion
- `change-detector.ts` / `relevance-filter.ts` — Change detection and filtering

## Auto-Update Instructions

After changes to files in this directory or subdirectories, run `/update-claude-md`
to keep this documentation synchronized with the codebase.
