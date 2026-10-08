# Instagram article tooling: local credentials

Instagram helper scripts используют два gitignored файла. Значения нельзя
вставлять в чат, логи, screenshots или commit.

Перед созданием файлов проверьте:

```bash
git check-ignore .secrets/instagram-token.json
git check-ignore .secrets/metravel-token.json
```

## Instagram Graph token

Один токен обслуживает `scripts/instagram-media.js` (ссылки на публикации) и
`scripts/instagram-insights.js` (недельная статистика для агента `instagram-editor`).
Действующий токен — бессрочный Page token, получен 05.10.2026. Он умирает при выходе
владельца из Facebook на всех устройствах, смене пароля или снятии доступа приложения;
тогда скрипты отвечают `Token rejected` и токен перевыпускается так:

1. Напечатать адрес окна согласия и открыть его в браузере, где владелец вошёл в Facebook:

```bash
node scripts/instagram-insights.js --auth-url
```

2. Пройти окно до конца («Продолжить» … «Сохранить»). Согласие даёт только владелец сам.
   Браузер попадёт на страницу metravel.by с ответом 400 «OAuth callback requires code and
   state» — это ожидаемо: сайт код не использует, он остаётся для шага 3.
3. В течение ~10 минут скопировать адрес этой страницы (или весь её текст: Cmd+A, Cmd+C) и
   обменять код на токен — ничего секретного не печатается:

```bash
pbpaste | node scripts/instagram-insights.js --exchange-code
```

Скрипт покажет выданные permissions и сохранит Page token в `.secrets/instagram-token.json`.
Нужны `instagram_basic`, `instagram_manage_insights`, `pages_show_list`,
`pages_read_engagement`, `business_management` (Страница принадлежит Business Manager — без
него список Страниц пуст). Право должно быть добавлено приложению в Meta for Developers →
«Сценарии использования» → Instagram → «Разрешения и функции», иначе окно согласия отвечает
`Invalid Scopes`.

Запасной путь — short-lived user token из Graph API Explorer: сохранить его как
`{ "access_token": "..." }` в `.secrets/instagram-token.json` и выполнить
`node scripts/instagram-insights.js --exchange`.

Не документируйте конкретный token или секрет приложения.

## MeTravel API token

Не копируйте token из browser localStorage: web auth может использовать
HttpOnly-cookie, а ручное извлечение создаёт утечку. Используйте существующий валидный авторский credential (id1) через общий resolver
(`docs/DEVELOPMENT.md` → «Operator token sessions»); author не входит через QA
и `get-quest-token.js` выдаёт только статус QA104. Формат readonly авторского файла:

```json
{ "token": "..." }
```

Путь: `.secrets/metravel-token.json`.

Перед любой write-операцией проверьте владельца token и сделайте backup исходной
article payload. Авторство новой статьи определяется token при создании и не
должно предполагаться по локальному default.

## Скрипты

- `node scripts/instagram-media.js` — получить media metadata;
- `node scripts/instagram-match.js` — подготовить сопоставление;
- `node scripts/instagram-publish.js` — mutating publish step, только после
  проверки backup, автора и выбранных записей.

Промежуточные данные остаются в ignored cache. Creative article text и массовая
production write-операция требуют отдельного явного подтверждения по
`AGENTS.md`.
