# Changelog

All notable changes to this project will be documented in this file.

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
