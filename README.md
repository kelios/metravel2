# reactNativeMetravel

# Pre install

https://nodejs.org/en
current version 18.17.1

create .env file

Set next variable:
PROD_API_URL = https://metravel.by
LOCAL_API_URL = http://192.168.50.4:8000
IS_LOCAL_API = false

# Install dependencies

```bash
npm install
```

If you prefer Yarn and have it installed, you can run:

```bash
yarn install
```

# Run project

- `./env.sh dev` — применяет `.env.dev`, проверяет зависимости и запускает Expo
- или `npx expo start`
- Press `w` to open the web build

## SEO / Indexing assets

- `public/robots.txt` — описывает базовые правила обхода и указывает на основную карту сайта. При изменении домена или добавлении дополнительных карт обязательно обновляйте ссылку `Sitemap` и директиву `Host`.
- `public/sitemap.xml` — статичная карта для ключевых разделов веб-версии. Обновляйте список `<url>` и значения `<lastmod>` при добавлении новых страниц или релизе крупных изменений контента.

После правок перезапустите веб-сервер Expo/Next, чтобы убедиться, что файлы доступны по `https://localhost:8081/robots.txt` и `https://localhost:8081/sitemap.xml` (или по адресу production-окружения).
