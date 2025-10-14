# Repository Guidelines

## Project Structure & Module Organization
- Keep implementation under `src/`; feature folders (`decode/`, `dom/`, `net/`, `overlay/`, `react/`) isolate domains while `src/index.ts` re-exports the public API.
- Generated bundles and declarations land in `dist/`; treat them as read-only and regenerate via `pnpm run build`.
- Vitest suites live in `tests/`, with reusable steganography helpers in `test/inspectStega.mjs`. Import from there instead of duplicating fixtures.
- Use `examples/` for manual verification snippets and refresh them whenever the exported API changes.

## Build, Test, and Development Commands
- `pnpm install` installs dependencies (Node.js ≥18 as enforced in `package.json`).
- `pnpm run build` clears `dist/` then compiles TypeScript with `tsc`.
- `pnpm run test` runs the full Vitest suite once; `pnpm run test:watch` keeps the runner hot during feature work.
- `pnpm run clean` removes `dist/`. Publishing relies on `pnpm run prepublishOnly`, which chains build + tests.

## Coding Style & Naming Conventions
- Strict TypeScript config forbids `any`; favor explicit interfaces or shared helpers in `src/utils/`.
- Use two-space indentation, camelCase for variables/functions, PascalCase for types/enums, and descriptive filenames such as `buildDatoDeepLink.ts` or `withContentLinkHeaders.ts`.
- Prefer named exports and colocate React hooks or components under `src/react/` to keep imports consistent.

## Testing Guidelines
- Create specs in `tests/<module>.test.ts`; align describe blocks with the feature folders for clarity.
- Use Vitest’s JSDOM environment (see `vitest.config.ts`) for DOM behaviour and import `test/inspectStega.mjs` helpers when validating overlay decoding.
- Run `pnpm run test` before committing and extend coverage whenever parsing, DOM mutation, or network utilities change.

## Commit & Pull Request Guidelines
- Follow local history: concise, present-tense commit subjects under ~60 characters (e.g., `fix decode guard`).
- Pull requests should state intent, link issues, and include local `pnpm run test` output. Attach screenshots or screencasts when overlay UI shifts.
- Flag breaking API updates in the PR body and mirror changes in `README.md` or `examples/`.

## Security & Configuration Tips
- Keep DatoCMS credentials in local `.env` files and exclude them from commits.
- Verify preview or demo endpoints use HTTPS before sharing overlay builds externally.
- Until the first public release, backward compatibility is optional—opt for clear, maintainable APIs over legacy shims.
