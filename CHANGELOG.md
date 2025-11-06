# Changelog

All notable changes to this project will be documented in this file.

## Unreleased
- Add image-alt helpers (`stripDatoImageAlt`, `decodeDatoImageAlt`, `withDatoImageAlt`) for render pipelines that skip DOM auto-cleaning.
- Extend `autoCleanStegaWithin` options with `observeImageAlts` so integrators can control `alt`-attribute observation separately from cleaning.
- Document image-alt workflows, add Next.js helper example, and cover the new utilities with tests.
- Refactor `enableDatoVisualEditing` to return a controller with `enable`, `disable`, `toggle`, `dispose`, and state helpers (`isEnabled`, `isDisposed`).
- Add `autoEnable` option for manual control flows and expose toggle-ready examples in plain JS and Next.js demos.
- Update tests and documentation to cover overlay toggling and controller lifecycle semantics.
- Unify preview environment variables under `DATOCMS_VISUAL_EDITING_*` and load them via shared dotenv setup (includes CLI helper support).
- Remove `devPanel` option and lifecycle callbacks (`onReady`, `onMarked`, `onStateChange`, `onWarning`); rely on the existing DOM CustomEvents instead.
- BREAKING: `withContentLinkHeaders` now requires `baseEditingUrl` as the second argument and always sets `X-Base-Editing-Url` from that value. Passing the header manually is no longer supported.

## 0.8.0 - 2025-10-16
- Controller: new public `refresh(root?)` plus lifecycle callbacks (`onReady`, `onMarked`, `onStateChange`, `onWarning`) and DOM events (`EVENT_READY`, `EVENT_MARKED`, `EVENT_STATE`, `EVENT_WARN`).
- Debugging: added `checkStegaState(root?)`, optional `devPanel` overlay, `DatoVisualEditingDevPanel` React component, and `data-datocms-editable` flag on every target.
- React: introduced `useDatoVisualEditingListen` for Dato “Listen” streaming previews.
- Warnings: development builds now surface a single notification when `enable()` finds zero editables (common when DOM nodes were replaced during streaming).
- Docs & examples: expanded streaming guidance, linked listen-ready examples (Next.js App Router + Pages Router + Remix), and updated README to cover the new APIs.

## 0.7.1 - 2025-10-11
- Initial public release of `datocms-visual-editing`.
- Click-to-edit overlays for content rendered from DatoCMS.
- DOM observer & overlay with activation toggles and cleanup disposer.
- Stega decoding utilities (`decodeStega`, `stripStega`) and AutoClean (DOM + React).
- Deep-link utilities (`buildDatoDeepLink`) and explicit tagging helpers (`buildEditTagAttributes`, `applyEditTagAttributes`).
- `withContentLinkHeaders` helper to set required headers (`X-Visual-Editing`, `X-Base-Editing-Url`).
- Examples for plain JavaScript and Next.js App Router.
- Requirements: Node ≥ 18, ESM.

[0.7.1]: https://github.com/marcelofinamorvieira/DatoContentLink/compare/v0.7.0...v0.7.1
