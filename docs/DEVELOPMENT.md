# Development

## Prerequisites

- Node.js 18+
- npm

## Install

```bash
npm install
cp .env.dev .env
```

## Run

```bash
npm start
npm run web
npm run ios
npm run android
```

## Environments

- Use `./env.sh dev|preprod|prod` if you need explicit environment switching.

## Backend API

- **Backend API**
  - Base URL: `${EXPO_PUBLIC_API_URL}`
  - Redoc UI: `${EXPO_PUBLIC_API_URL}/api/schema/redoc/`
  - OpenAPI schema: `${EXPO_PUBLIC_API_URL}/api/schema/`
  - Auth header: `Authorization: Token <token>`

### Upload collections (travel media)
- `travelMainImage` — обложка маршрута
- `travelImageAddress` — изображения точек маршрута
- `gallery` — галерея путешествия (предпочтительно для блока фото)
- `description` — изображения из поля описания

### Core endpoints (OpenAPI)

- **Travels**
  - `GET /api/travels/` (query params: `page`, `perPage`, required `where`, optional `query`)
  - `GET /api/travels/{id}/`
  - `GET /api/travels/by-slug/{slug}/`
  - `GET /api/travels/random/`
  - `PATCH /api/travels/{id}/mark-as-favorite/`
  - `PATCH /api/travels/{id}/unmark-as-favorite/`
- **Filters**
  - `GET /api/getFiltersTravel/`
  - `GET /api/countries/`
  - `GET /api/countriesforsearch/`
- **User**
  - `POST /api/user/login/`
  - `POST /api/user/logout/`
  - `POST /api/user/registration/`
  - `POST /api/user/confirm-registration/`
  - `POST /api/user/reset-password-link/`
  - `POST /api/user/set-password-after-reset/`
  - `GET /api/user/{id}/profile/`
  - `PUT /api/user/{id}/profile/update/`
  - `PUT /api/user/{id}/profile/avatar-upload/`
  - `GET /api/user/{id}/favorite-travels/`
  - `GET /api/user/{id}/history/`
  - `DELETE /api/user/{id}/clear-history/`
  - `DELETE /api/user/{id}/clear-favorite/`
  - `GET /api/user/{id}/recommended-travels/`

### Pagination format

For travel list endpoints (`/api/travels/`, `/api/travels/random/`) the schema is DRF-style:

- `count`: total items
- `next`: next page URL or `null`
- `previous`: previous page URL or `null`
- `results`: array of items

## Tests

```bash
npm run test
npm run test:coverage
```
