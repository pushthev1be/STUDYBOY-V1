# Changelog

All notable changes to StudyGenius AI are documented here.

## [2025-02-10] Fix Render build failure + architecture hardening

- **Removed** `temp_old_service.ts` - corrupted UTF-16 backup of `geminiService.ts` with broken `../types` import that caused `tsc` to fail during `tsc && vite build`
- **Updated** `tsconfig.json` - added `exclude` for `node_modules` and `dist` to prevent stray files from breaking the TypeScript build

## [2025-02-10] Fix flashcard load more + increase base count to 15

- **Fixed** "Load More Flashcards" button not showing newly generated cards - `displayedCards` was stale React state that never updated when new cards arrived via `onLoadMore`; replaced with derived value `cards.length`
- **Increased** base flashcard generation count from 10-12 to 15 in AI prompts (both initial generation and load more)
- **Removed** dead `FLASHCARDS_PER_LOAD` constant and unreachable guard code in `nextCard()`
