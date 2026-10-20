## 1. Независимые отчёты

- [x] 1.1 Добавить общий контракт строк, запросов, Instagram-алиасов и nullable качества.
- [x] 1.2 Добавить sourceBreakdown к CLI без изменения Unassigned.
- [x] 1.3 Включить отдельные месячные запросы и таблицу источников с изоляцией ошибок.

## 2. Документация и source validation

- [x] 2.1 Записать UTM profile/story/reel, правило целевого пути и отложенную активацию.
- [x] 2.2 Выполнить regression tests, syntax/ESLint, audit:prompts и strict change validation.
- [ ] 2.3 Пройти независимый review-and-fix и code-review gate; commit/push явных путей #2694.

## 3. Приёмка

- [ ] 3.1 В testing выполнить реальные read-only stats:ga4 и stats:summary, проверить Instagram/качество/отсутствие секретов.
- [ ] 3.2 Зафиксировать pass в #2694, сохранив blocked_by #2659 у #2680, синхронизировать и архивировать OpenSpec.
