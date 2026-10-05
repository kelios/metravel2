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

1. Meta Graph API Explorer → выбрать приложение MeTravel (то же, через которое сайт
   публикует в Instagram) → User Token с permissions: `instagram_basic`,
   `instagram_manage_insights`, `pages_show_list`, `pages_read_engagement`.
2. Сохранить его локально, путь `.secrets/instagram-token.json`:

```json
{ "access_token": "..." }
```

3. Обменять на бессрочный Page token (app id/secret берутся из
   `.secrets/metravel-instagram.env`, ничего секретного не печатается):

```bash
node scripts/instagram-insights.js --exchange
```

Скрипт перезапишет файл Page-токеном и покажет недостающие permissions. Page token,
полученный из long-lived user token, не истекает, но умирает при выходе владельца из
Facebook на всех устройствах, смене пароля или снятии доступа приложения — тогда
повторить шаги 1–3.

Не документируйте конкретный token, App ID или аккаунт.

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
