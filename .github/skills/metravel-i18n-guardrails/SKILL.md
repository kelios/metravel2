---
name: metravel-i18n-guardrails
description: Implement and review metravel localization across production web, Android, and iOS/iPadOS. Use when work changes user-facing copy, accessibility, validation/errors, language selection, locale persistence, dates/numbers/plurals, SEO locale metadata, geocoder language, PDF/export UI, translation resources, or shared multilingual UI for RU/BE/UK/PL/EN.
---

# Metravel I18n Guardrails

Read `AGENTS.md`, `docs/RULES.md`, and
`docs/DEVELOPMENT.md#localization` before localization work.

- Treat `i18n/config.ts` as the locale source of truth. Production locales are
  RU/BE/UK/PL/EN; Russian is the default/fallback.
- Use `useTranslation()` from `@/i18n` for React UI and shared translation
  helpers outside React. Add every new key to all production locale resources.
- Use `i18n/format.ts` for dates, numbers, currency, lists, relative time,
  collation, and plurals. Do not hardcode `ru-RU` or manual plural rules.
- Localize app-owned UI and accessibility text. Do not client-translate
  user/editorial/API content, place names, comments, messages, or backend codes
  without a separate content-locale/API contract.
- Preserve deterministic web SSR/hydration, native locale discovery and
  persistence, and the optimized web/full-native resource split.
- Run `npm run test:i18n` plus the feature checks. Verify affected locales on
  every affected platform; web, Android, and iOS evidence are separate.

