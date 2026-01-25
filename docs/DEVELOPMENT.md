# Development guide

## Project root

- Current project: `metravel2`
- Run all commands from the `metravel2/` app root (this folder contains `package.json`).

## Setup

```bash
npm install
cp .env.dev .env
```

## Start

```bash
npm run start
```

### Web

```bash
npm run web
```

### iOS / Android

```bash
npm run ios
npm run android
```

## Useful scripts

- `npm run lint` — ESLint.
- `npm run format` — Prettier.
- `npm run clean` — Expo start with clear cache.
- `npm run reset` — Expo reset cache.
- `npm run check-deps` — dependency checks.
- `npm run check:image-architecture` — enforces image/card architecture rules (also runs in `npm run test:ci`).

## Environment variables

Minimum required for unit tests and local dev:

- `EXPO_PUBLIC_API_URL` — backend base URL.

Optional:

- OpenRouteService key for routing (see `README.md`).

## Project structure (high level)

- `app/` — Expo Router routes/pages.
- `components/` — UI/components.
- `hooks/`, `utils/`, `src/` — business logic and utilities.
- `__tests__/` — unit/integration tests.
- `e2e/` — Playwright end-to-end tests.
- `constants/` — design system tokens.

## UI implementation rules

See `RULES.md`.

## SEO/Meta implementation

**Для нових сторінок завжди використовуйте централізовані SEO утиліти:**

```tsx
import { buildCanonicalUrl, buildOgImageUrl } from '@/utils/seo';
import InstantSEO from '@/components/seo/LazyInstantSEO';
import { usePathname } from 'expo-router';
import { useIsFocused } from '@react-navigation/native';

export default function MyPage() {
  const pathname = usePathname();
  const isFocused = useIsFocused();

  return (
    <>
      {isFocused && (
        <InstantSEO
          headKey="my-page"
          title="My Page | Metravel"
          description="Page description"
          canonical={buildCanonicalUrl(pathname || '/my-page')}
          image={buildOgImageUrl('/og-preview.jpg')}
          ogType="website"
        />
      )}
      {/* Your content */}
    </>
  );
}
```

**Важливо:**
- Завжди `buildCanonicalUrl()` замість ручної конкатенації
- Завжди `buildOgImageUrl()` для consistency
- Wrap у `isFocused` для уникнення конфліктів
- Унікальний `headKey` для кожної сторінки
- `robots="noindex,nofollow"` для auth/приватних сторінок

**Детальна документація:** `docs/SEO_MIGRATION.md`
