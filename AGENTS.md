# Repository Guidelines

## Project Structure & Module Organization
- `src/` hosts the TypeScript source; features live in focused folders (`decode/`, `dom/`, `net/`, `overlay/`, `react/`), while `src/index.ts` re-exports the public API.
- `dist/` contains compiled ESM output and declarations from the build process—never modify generated files directly.
- `tests/` stores Vitest specs (unit and integration), and `test/inspectStega.mjs` offers reusable helpers for steganography assertions.
- `examples/` provides manual verification snippets; keep them updated with the latest APIs to avoid drift.

## Build, Test, and Development Commands
- `pnpm install` installs dependencies; the toolchain expects Node.js 18 or newer.
- `pnpm run build` cleans and compiles via `tsc`, emitting distributables into `dist/`.
- `pnpm run test` runs the full Vitest suite once—mirror CI by using this before opening a PR.
- `pnpm run test:watch` starts Vitest in watch mode for rapid feedback during feature work.
- `pnpm run clean` removes `dist/`, ensuring subsequent builds start from a blank slate.

## Coding Style & Naming Conventions
- Adhere to the strict TypeScript settings in `tsconfig.json`; avoid `any` and prefer explicit interfaces or utility types in `src/types.ts`.
- Keep indentation at two spaces, rely on named exports, and favor small, reusable utilities under `src/utils/`.
- File names remain descriptive kebab-case (`buildDatoDeepLink.ts`, `withContentLinkHeaders.ts`); types and enums use PascalCase, functions and variables use camelCase.
- When adding React hooks or components, place them under `src/react/` and mirror the existing folder hierarchy to simplify imports.

## Testing Guidelines
- Co-locate new unit tests with peers in `tests/*.test.ts`, matching filenames to modules when possible.
- Use Vitest + JSDOM helpers (configured in `vitest.config.ts`) to simulate DOM behavior; import steganography fixtures from `test/inspectStega.mjs` for integration flows.
- Run `pnpm run test` locally before pushing; add regression coverage whenever modifying parsing, DOM mutation, or network code.
- Document any required environment variables or DatoCMS credentials in the PR if a test setup depends on them.

## Commit & Pull Request Guidelines
- Follow the existing history: concise, present-tense summaries under 60 characters (`add overlay helpers`, `fix decode guard`), grouping related changes per commit.
- PRs should describe intent, outline testing evidence (`pnpm run test` output), and link relevant issues or tickets.
- Include screenshots or screencasts when UI overlays change, flag breaking API updates, and mention documentation edits in `README.md` or `examples/` as applicable.
