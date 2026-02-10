# Changelog

All notable changes to StudyGenius AI are documented here.

## [2026-02-10] API response time optimization

- **Fixed** thinking config for Gemini 3 — switched from `thinkingBudget: 0` (Gemini 2.5 param) to `thinkingLevel: "MINIMAL"` which is the correct Gemini 3 parameter; can reduce response time 30-70%
- **Added** `maxOutputTokens` caps to all API calls — 8000 for initial generation, 4000 for extend quiz/flashcards, 2000 for remediation questions; prevents runaway generation
- **Trimmed** prompt verbosity across all API calls — shorter prompts mean faster processing and fewer input tokens
- **Files changed**: `services/geminiService.ts`

## [2026-02-10] Quiz improvements: more questions, subtopics, session history

- **Increased** base quiz question count from 8 to 15 for richer practice sessions
- **Increased** "Extend Case Study" from 3 to 5 new questions per request
- **Added** subtopic field to quiz questions — questions are now grouped under clear subtopic headings (e.g. Pathophysiology, Pharmacology, Diagnosis)
- **Added** past quiz session history — completed sessions are saved to localStorage and displayed in a collapsible panel with score, date, and topic
- **Updated** AI prompts and JSON schemas to include subtopic in all question generation paths
- **Files changed**: `types.ts`, `services/geminiService.ts`, `components/QuizView.tsx`, `App.tsx`

## [2026-02-10] Fix Render build failure + architecture hardening

- **Removed** `temp_old_service.ts` - corrupted UTF-16 backup of `geminiService.ts` with broken `../types` import that caused `tsc` to fail during `tsc && vite build`
- **Updated** `tsconfig.json` - added `exclude` for `node_modules` and `dist` to prevent stray files from breaking the TypeScript build

## [2025-02-10] Fix flashcard load more + increase base count to 15

- **Fixed** "Load More Flashcards" button not showing newly generated cards - `displayedCards` was stale React state that never updated when new cards arrived via `onLoadMore`; replaced with derived value `cards.length`
- **Increased** base flashcard generation count from 10-12 to 15 in AI prompts (both initial generation and load more)
- **Removed** dead `FLASHCARDS_PER_LOAD` constant and unreachable guard code in `nextCard()`
