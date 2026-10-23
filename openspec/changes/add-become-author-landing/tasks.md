## 1. Shared page and discovery

- [x] 1.1 Add the public static author landing with four truthful benefits, hidden contest, shared responsive/theme primitives, and safe guest/authenticated creation actions.
- [x] 1.2 Add author banner variants and a crawlable landing link; place one banner in the home ScrollView and reuse the catalog footer, including its memo comparator.
- [x] 1.3 Add landing CTA and banner click analytics while preserving existing banner variants and avoiding duplicate activation events.

## 2. Localization and metadata

- [x] 2.1 Provide RU/BE/UK/PL/EN page/banner/accessibility/SEO strings in existing resource families and check wrapping and length budgets.
- [x] 2.2 Register static page metadata and critical/runtime metadata for self-canonical `/become-author`; preserve unrelated shared-file changes and avoid backend sitemap edits.

## 3. Code-level verification and review

- [ ] 3.1 Cover benefits/contest absence, guest and authenticated CTA, banner destination/old variants, event parameters, catalog comparator, and raw metadata with focused regressions.
- [ ] 3.2 Run relevant Jest, lint/typecheck/guards, `npm run test:i18n`, `npm run audit:prompts`, and strict change validation.
- [ ] 3.3 Complete independent full-diff review-and-fix and required code-review gate; repeat checks for confirmed fixes before testing.

## 4. Testing and Done gate

- [ ] 4.1 Follow the authorized explicit-path commit/push and testing/deploy pipeline; confirm deployed source sha before production acceptance.
- [ ] 4.2 Capture production home/catalog/landing at 390 and 1440 in light/dark themes; verify one catalog banner, no horizontal scroll, keyboard focus, touch targets, and console.
- [ ] 4.3 Verify all five locales, guest registration/login continuation and authenticated wizard entry without publishing; check real click events and raw/hydrated SEO metadata.
- [ ] 4.4 Record evidence and update the board Done gate; run `openspec validate --all` before any later archive. No platform-specific device gate is added by this shared change.
