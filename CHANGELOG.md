# Changelog

All notable changes to this project will be documented in this file.

## Unreleased
- Refactor `enableDatoVisualEditing` to return a controller with `enable`, `disable`, `toggle`, `dispose`, and state helpers (`isEnabled`, `isDisposed`).
- Add `autoEnable` option for manual control flows and expose toggle-ready examples in plain JS and Next.js demos.
- Update tests and documentation to cover overlay toggling and controller lifecycle semantics.
- Unify preview environment variables under `DATOCMS_VISUAL_EDITING_*` and load them via shared dotenv setup (includes CLI helper support).

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
