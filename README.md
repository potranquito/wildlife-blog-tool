# wildlife-blogger (MVP)

AI-assisted research + blog generation + publishing for wildlife conservation.

## What’s included

- Public blog: `/blog` + SEO-friendly post pages
- Dashboard (protected): research competitor URLs, build a knowledge base, generate drafts, edit, publish
- Local file storage under `data/` (easy to swap to Postgres later)

## Local dev

1. Copy env:
   - `cp .env.example .env.local`
2. Install deps (offline works if your pnpm store is primed):
   - `pnpm install --offline || pnpm install`
3. Run:
   - `pnpm dev`

The app auto-creates a starter org profile and a sample post on first run.

## Deployment

See `DEPLOYMENT.md`.
