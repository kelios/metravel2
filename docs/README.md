# Project docs

## Current project

- The current project is `metravel2`.
- The application root is `./` (this folder contains `package.json`).
- Run all `npm` commands from this folder.

## Important docs

- `RULES.md` — development and UI rules.
- `DEVELOPMENT.md` — local setup and day-to-day dev workflow.
- `TESTING.md` — Jest + Playwright.
- `RELEASE.md` — release/deploy checklist.

## Quick start

```bash
npm install
npm run start
```

### Web

```bash
npm run web
```

### Tests

- Watch mode:

```bash
npm run test
```

- Single run (recommended for CI/local checks):

```bash
npm run test:run
```

- Coverage:

```bash
npm run test:coverage
```

### Lint

```bash
npm run lint
```

## Backend API

- Base URL: `EXPO_PUBLIC_API_URL` (must include host; `/api` suffix is added automatically by clients)
- Redoc: [`http://192.168.50.36/api/schema/redoc/`](http://192.168.50.36/api/schema/redoc/)
- OpenAPI schema: `${EXPO_PUBLIC_API_URL}/api/schema/`
- Auth: `Authorization: Token <token>`

### Auth
- `POST /api/user/login/` → `{ token, name, email, id, is_superuser }`
- `POST /api/user/logout/` → `204`
- `POST /api/user/registration/` → creates account
- `POST /api/user/confirm-registration/` → confirms via code
- `POST /api/user/reset-password-link/` → sends reset link
- `POST /api/user/set-password-after-reset/` → sets new password
- `POST /api/user/sendpassword/` → sends password recovery code
- `POST /api/user/refresh/` → `{ access, refresh? }` (refresh flow via `apiClient`)

### Travels
- `GET /api/travels/` → list (`results + count` or `data + total`)
- `GET /api/travels/random/` → array of travel cards
- `GET /api/travels/of-month/` → featured travels of month
- `GET /api/travels/{id}/near/` → nearby travels (404 → empty)
- `GET /api/travels/popular/` → popular travels
- `GET /api/travels/search_travels_for_map/?page&perPage&where` → geo list for map
- `POST /api/travels/near-route/` (body: GeoJSON LineString + tolerance meters) → travels along route
- `PUT /api/travels/upsert/` (auth) → create/update travel, returns saved Travel

### Travel actions
- `PATCH /api/travels/{id}/mark-as-favorite/` (auth) → mark favorite
- `PATCH /api/travels/{id}/unmark-as-favorite/` (auth) → unmark favorite

### Articles
- `GET /api/articles?page&perPage&where` → `{ data, total }` or array
- `GET /api/articles/{id}` → single Article

### Filters, countries, feedback, AI
- `GET /api/getFiltersTravel/` → filters: countries, categories, transports, companions, complexity, month, over_nights_stay, categoryTravelAddress, year
- `GET /api/countriesforsearch/` → countries for search form
- `GET /api/countries/` → all countries
- `POST /api/feedback/` → sends feedback
- `POST /api/chat` → AI assistant reply (validated message)

### User profile & history (auth)
- `GET /api/user/{id}/profile/` → profile
- `PUT /api/user/{id}/profile/update/` → update profile fields
- `PUT /api/user/{id}/profile/avatar-upload/` (JSON or multipart) → update avatar
- `GET /api/user/{id}/favorite-travels/` → list of favorite travels
- `GET /api/user/{id}/history/` → list of viewed travels
- `DELETE /api/user/{id}/clear-history/` → clears history
- `DELETE /api/user/{id}/clear-favorite/` → clears favorites
- `GET /api/user/{id}/recommended-travels/` → recommended travels

### Примеры запросов

Авторизация (получить токен):

```bash
curl -X POST http://192.168.50.36/api/user/login/ \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","password":"******"}'
```

Список путешествий с токеном:

```bash
curl -X GET "http://192.168.50.36/api/travels/?page=1&perPage=10" \
  -H "Authorization: Token <token>"
```

Типичный ответ списка путешествий:

```json
{
  "results": [
    {
      "id": 123,
      "name": "Alps hike",
      "slug": "alps-hike",
      "url": "/travels/alps-hike",
      "countryName": "Switzerland",
      "travel_image_thumb_url": "https://.../thumb.jpg",
      "countUnicIpView": "10",
      "publish": 1,
      "moderation": 1
    }
  ],
  "count": 1
}
```
