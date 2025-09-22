# Repository Guidelines

## Project Structure & Module Organization
Primary bots live in `trendV2.tsx` and `maker.ts`; CLI surfaces tasks via `cli.ts`, `bot.ts`, `watch.ts`, and `liveAster.ts`. Exchange adapters stay in `exchanges/` with `aster.ts` for Bitget connectivity and `aster.test.ts` as the contract test. Shared logic sits in `utils/` (`order.ts` orchestrates orders, `log.ts` tracks fills, `helper.ts` provides math). Park prototypes in `backup/`. Place docs in `docs/` and keep `README.md` and `README_en.md` synchronized.

## Build, Test, and Development Commands
Install dependencies with `pnpm install` (repo pins pnpm 10.x). Run the trend bot using `pnpm start`; switch to the maker workflow with `pnpm maker`. Operational commands live behind `pnpm cli:start`, `pnpm cli:log`, and `pnpm cli:reset`. Execute automated checks with `pnpm test`. Use `pnpm aster:test` when iterating on the Bitget adapter.

## Coding Style & Naming Conventions
Write TypeScript ES modules with 2-space indentation and trailing commas. Keep imports ordered (stdlib, external, internal) and group type-only imports. Use camelCase for functions, PascalCase for classes, and SCREAMING_SNAKE_CASE for config constants. There is no enforced formatter; run Prettier locally if available or ensure consistent spacing manually. Log output should remain terse and bilingual comments should add real context.

## Testing Guidelines
Vitest backs the suite. Co-locate specs with their modules (`exchanges/foo.test.ts`, `utils/bar.test.ts`). Name describe blocks after user outcomes and mock remote exchanges to avoid live calls. Any change to order execution, risk checks, or CLI flows requires at least one regression case. Capture manual exchange dry-runs in the PR description when they influence confidence.

## Commit & Pull Request Guidelines
Commits follow descriptive present-tense summaries, sometimes bilingual—mirror that tone and cover one logical change per commit. Include linked issue IDs in the body when available. Pull requests should explain the trading impact, list config toggles or new environment variables, and attach screenshots or logs for CLI output. State the results of `pnpm test` plus any manual verification so reviewers can replay them quickly.

## Configuration & Secrets
Copy `env.example` to `.env.local` for development and keep credentials out of version control. Store tunable thresholds in `config.ts`; note downstream effects when editing defaults. Document any new environment keys in both the example file and the READMEs.
