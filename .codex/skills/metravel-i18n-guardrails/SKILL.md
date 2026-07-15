---
name: metravel-i18n-guardrails
description: Implement and review metravel localization across production web, Android, and iOS/iPadOS. Use when work adds or changes user-facing copy, validation/errors, accessibility labels, language selection, locale persistence, dates/numbers/plurals, SEO locale metadata, geocoder language, PDF/export UI, translation resources, or any shared UI whose behavior must remain correct for RU/BE/UK/PL/EN.
---

# Metravel I18n Guardrails

Apply the shared localization contract without changing the meaning of API-owned
content or breaking the web/native runtime split.

Read first:

- `AGENTS.md`
- `docs/RULES.md`
- `docs/DEVELOPMENT.md#localization`
- `docs/ARCHITECTURE.md#локализация`
- `i18n/config.ts`, `i18n/resources.ts`, and the nearest i18n tests for code work

## Architecture Contract

- Treat `i18n/config.ts` as the locale source of truth. The current production
  registry is RU/BE/UK/PL/EN; Russian is the default and fallback locale.
- Keep the deterministic web contract: static HTML starts from the Russian
  baseline, hydration matches it, and persisted/system preference is applied by
  `LocaleProvider` after hydration.
- Keep native locale discovery through `expo-localization` with the existing
  Intl fallback and versioned preference storage.
- Preserve the optimized `*.web.ts(x)` compile-time/runtime path and the full
  i18next resource contract used by native and Jest.
- Treat Russian resources as the typed key contract. Every production locale
  must provide the same namespaces and keys through `defineLocaleResources()`.

## Implementation Rules

- Localize app-owned UI copy: labels, actions, accessibility text, validation,
  errors, toasts, empty states, legal/SEO/PDF UI, and display dictionaries.
- Do not translate user/editorial/API content, place names, comments, messages,
  quest/travel/article prose, search aliases, or stable backend codes on the
  client. Require a separate content-locale/API contract for those values.
- Use `useTranslation()` from `@/i18n` in React components. Use `translate()` or
  `getFixedTranslator()` in non-React code.
- Do not compute translated module-level constants once. Use factories, getters,
  or reactive hooks so language changes update visible output.
- Use `i18n/format.ts` for dates, numbers, currency, lists, relative time,
  collation, and plural selection. Do not hardcode `ru-RU`, manual plural modulo
  rules, or locale-sensitive business logic based on translated labels.
- Keep `lang`, `dir`, OpenGraph locale, geocoder language, and accessibility
  labels derived from the active locale registry.
- Do not add locale URL prefixes or `hreflang` until a separate SEO routing
  contract explicitly authorizes them.

## Workflow

1. Record localization impact before editing: affected UI keys, namespaces,
   formats, SEO/accessibility surfaces, and target platforms.
2. Reuse an existing namespace and key pattern; add every new key to all current
   locale resources in the same change.
3. Check web SSR/hydration behavior and native cold-start/persisted-locale impact
   for shared provider, storage, or configuration changes.
4. Run `npm run test:i18n` for any localization or user-facing copy change, then
   run the normal checks required by the touched feature.
5. Verify the changed user flow in every affected locale/platform. If an Android
   device or iOS simulator/device is unavailable, report that platform as
   `verify pending`; do not substitute web evidence for native verification.

## Handoff

Report affected locales, namespaces/keys, web/Android/iOS impact, checks and
runtime evidence, and any exact platform verification blocker.
