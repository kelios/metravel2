---
name: review-security
description: >-
  Поиск уязвимостей во фронтенде MeTravel: XSS/санитизация rich text, инъекции
  через URL/атрибуты, утечки секретов и токенов, обходы allowlist'ов, опасные
  зависимости; подтверждённое исправляется, бэкенд-дыры — TASK-файлом. Триггеры:
  «поиск уязвимостей», «security review», «проверь на XSS».
---

# review-security

Ревью **безопасности фронтенда**. Scope по умолчанию — весь репозиторий.
Бэкенд не правим: дыры бэка → TASK-файл (`tasks/NNN-*.md`, Owner: Backend) +
строка в `docs/BACKEND_WORKBOARD.md` (см. память: security-бэклог tasks/012-042).

## Поверхности атаки (углы поиска — делегируй `review-auditor` параллельно)

1. **Rich text / HTML**: всё, что попадает в `dangerouslySetInnerHTML`/WebView, обязано
   пройти `utils/sanitizeRichText.ts`. Искать: обходы санитайзера, данные из
   sanitized-атрибутов, используемые без повторной валидации (src/href/URL из
   `data-*`), регексы-«санитайзеры» вместо sanitize-html, конкатенация HTML из
   пользовательских строк без `encodeHtml`.
2. **URL/навигация**: `openExternalUrl` и любые места, строящие URL из пользовательских
   данных — схемы `javascript:`/`data:`, открытые редиректы (`returnTo`/`redirect`
   без allowlist), `target="_blank"` без `rel="noopener"`.
3. **Секреты/токены**: захардкоженные ключи (grep по `api_key|secret|token|Bearer|AKIA`),
   секреты в логах/`console.log`, токен авторизации в URL/кэше/AsyncStorage без нужды,
   файлы вне `.secrets/`/env (проверить `git check-ignore`).
4. **Хранение/передача**: http:// вместо https:// к first-party хостам, чувствительные
   данные в query string, PII в аналитике.
5. **Зависимости**: `npm audit --omit=dev` (high/critical), известные дыры в pinned
   версиях (sanitize-html, leaflet, expo-плагины).
6. **Платформенное**: WebView с `javaScriptEnabled` + произвольным URL, deep links без
   валидации параметров, CSP-конфликты (`public/`, nginx — read-only, репортить).

## Верификация и фиксы

- Для каждой находки — **PoC-вход** (конкретная строка/URL/HTML, которая эксплуатирует),
  иначе кандидат отбрасывается. Severity: P1 — эксплуатируемо удалённо/из контента,
  P2 — нужны условия, P3 — hardening.
- Фронтовые фиксы применять сразу + регрессионный тест (как с `data-ig-embed`:
  allowlist хоста и на санитизации, и в рантайме). Бэкенд/инфра — TASK-файл.
- Найденный в коде/чате секрет = утёк: явно сказать + задача на ротацию.
- Отчёт: уязвимость → PoC → фикс/задача → тест.
