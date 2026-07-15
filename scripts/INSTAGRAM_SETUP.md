# Instagram article tooling: local credentials

Instagram helper scripts используют два gitignored файла. Значения нельзя
вставлять в чат, логи, screenshots или commit.

Перед созданием файлов проверьте:

```bash
git check-ignore .secrets/instagram-token.json
git check-ignore .secrets/metravel-token.json
```

## Instagram Graph token

Получите short-lived user token в Meta Graph API Explorer с минимально нужными
permissions для чтения media account и сохраните локально:

```json
{ "access_token": "..." }
```

Путь: `.secrets/instagram-token.json`.

Не документируйте конкретный token, App ID или аккаунт. Если Meta отклоняет
token, создайте новый через официальный Explorer и замените локальный файл.

## MeTravel API token

Не копируйте token из browser localStorage: web auth может использовать
HttpOnly-cookie, а ручное извлечение создаёт утечку. Получите token
программным login helper из разрешённого test/author account в `.env.e2e` и
запишите только в:

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
