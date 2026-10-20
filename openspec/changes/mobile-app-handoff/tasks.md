## 1. Implementation

- [x] 1.1 Add safe app handoff URLs and Safari static/SSG metadata for supported current routes.
- [x] 1.2 Extend existing mobile bar with localized Open/Install actions, seven-day dismissal and no permanent store-click suppression.
- [x] 1.3 Stack measured app/consent panels through the existing owner registry without self-feedback.

## 2. Code validation and review

- [x] 2.1 Run focused route/state/component/reserve/HTML tests, scoped lint/typecheck, external link guard and test:i18n.
- [x] 2.2 Complete independent full-diff review-and-fix and final review gate.
- [x] 2.3 Validate OpenSpec change strictly.

## 3. Testing after review

- [ ] 3.1 Check production desktop absence and mobile 320/390px first visit, cookies, menu, actions and dismissal with screenshots/console in all current locales.
- [ ] 3.2 Verify physical iPhone Safari installed/absent Smart App Banner and current-route handoff.
- [ ] 3.3 Verify physical Android Chrome installed current-route handoff and absent-app store fallback.

Code verification (2026-10-20): independent review and final gate PASS. Full Jest retained its raw 1880/1881-suite result; the only failing fixture was corrected without executable changes and passed 7/7 with ESLint/typecheck. Other nine relevant suites passed (171 tests), giving resolved coverage of 10 suites/178 tests. Evidence: `.codex-temp/mobile-app-handoff/fixture-resolution.json`. Runtime remains pending below.
