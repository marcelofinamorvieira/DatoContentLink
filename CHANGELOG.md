# Changelog

All notable changes to this project will be documented in this file.

## 0.7.0 - 2025-10-10
- Improved stega cleanup performance by reusing `vercelStegaSplit` results across auto-clean and observer flows (fewer allocations during mutation bursts).
- Hardened overlay launches by opening new-tab links with `noopener,noreferrer` and refreshing overlay geometry via `ResizeObserver`.
- Added an optional default `X-Base-Editing-Url` parameter to `withContentLinkHeaders` for friendlier setup.
- Polished overlay accessibility (`aria-live` root, `aria-hidden` segments) and refreshed docs around activation toggles.
- Declared the Node ≥ 18 engine requirement in `package.json`.
- Added `badgeLabel` for overlay localization, tightened focus hand-off when navigating in the same tab, and expanded `onBeforeOpen` with the resolved metadata payload.
- Preserved custom `fetch` `duplex` options and added coverage for query toggles, badge accessibility, min hit sizes, and Request bodies in `withContentLinkHeaders`.

## 0.6.0 - 2025-10-01
- **Breaking:** removed the click-conflict feature and `EnableOptions.clickConflict`, so overlay clicks always open the resolved DatoCMS deep link (with `openInNewTab` still respected).
- Dropped the conflict chooser UI, interactive heuristics, and the `data-datocms-click-conflict` / `data-datocms-allow-follow` overrides.
- Simplified overlay handling and refreshed docs/tests to reflect the always-open behaviour.

## 0.5.0 - 2025-09-28
- Added click-conflict modes (prefer-dato, prefer-page, prompt, modifier) so integrators can tune how editor jumps interact with existing navigation.
- Introduced `mergeSegments` proximity merging and larger default hit targets to keep clustered overlays readable.
- Shipped React helpers (`useDatoAutoClean`, `<DatoAutoClean />`) that wrap the DOM auto-cleaner with idiomatic hooks/components.
- Hardened stega cleanup with `persistAfterClean` defaults, improved keyboard/focus handling, and safer discovery heuristics.
- Expanded the public surface with `buildEditTagAttributes`, `applyEditTagAttributes`, and `withContentLinkHeaders` utilities plus `buildDatoDeepLink` for deep-linking.
- Updated documentation/examples, added Vitest coverage for deep links, click-conflict handling, and DOM cleanup flows.

## 0.1.0 - 2025-09-23
- Initial public release of `datocms-visual-editing`.
- Visual editing overlays that decode DatoCMS stega metadata without Vercel dependencies.
- DOM observer, overlay, and deep-link tooling with activation toggles and disposer cleanup.
- Helper utilities for Content Link headers, field-path normalization, and stega decoding.
- Examples for plain JavaScript and Next.js App Router, plus Vitest + jsdom coverage.
