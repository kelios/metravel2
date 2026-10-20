## 1. Независимые отчёты

- [x] 1.1 Добавить общий контракт строк, запросов, Instagram-алиасов и nullable качества.
- [x] 1.2 Добавить sourceBreakdown к CLI без изменения Unassigned.
- [x] 1.3 Включить отдельные месячные запросы и таблицу источников с изоляцией ошибок.

## 2. Документация и source validation

- [x] 2.1 Записать UTM profile/story/reel, правило целевого пути и отложенную активацию.
- [x] 2.2 Выполнить regression tests, syntax/ESLint, audit:prompts и strict change validation.
- [x] 2.3 Пройти независимый review-and-fix и code-review gate; commit/push явных путей #2694.

## 3. Приёмка

- [x] 3.1 В testing выполнить реальные read-only stats:ga4 и stats:summary, проверить Instagram/качество/отсутствие секретов.
- [x] 3.2 Зафиксировать pass в #2694, сохранив blocked_by #2659 у #2680, синхронизировать и архивировать OpenSpec.


## Evidence (2026-10-20)

- #2694: done; reviewed source commit `f26c1386d11e340ca3030152ed3ae14eff93996f` pushed to main.
- Independent review-and-fix and code-review gate: PASS without findings. Targeted Jest: 107 tests; staged pre-commit checks: PASS.
- One live read-only pass: `npm run stats:ga4 -- --channel-breakdown --days 7 --json` and `npm run stats:summary -- --json`; formatters checked against saved responses.
- GA4 2026-10-13–2026-10-19 Europe/Minsk: 108 sessions; `l.instagram.com/referral`: 2 sessions, target events `null/not_observed`. Monthly report: 12 completed months; native responses and existing aggregates matched.
- Метрика UNCONFIGURED remains an explicit data gap. Secret scan of 26 local artifacts: 0 matches. Evidence: ignored `.codex-temp/2694/acceptance.json`.
- #2680 remains blocked by #2659; classifier, client analytics and active Instagram links were not changed. This pass is not the #2659 measurement acceptance.
- All three requirements and four scenarios synced to `openspec/specs/ga4-source-conversions/spec.md`; no pending delta.
