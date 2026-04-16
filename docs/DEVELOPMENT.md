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

Dev note:

- Local web dev can show content loaded from production while related media files still depend on production storage/CDN access.
- Because of that, some article/travel images may fail in dev even when frontend code is correct.
- Do not patch app code only to silence this environment-specific limitation.
- Treat it as a bug only when frontend code generated an invalid URL or regressed existing media normalization.

### iOS / Android

```bash
npm run ios
npm run android
```

## Useful scripts

- `npm run lint` — ESLint.
- `npm run typecheck` — полный TypeScript audit (`tsc --noEmit`). Сейчас это отдельная проверка долга, а не cheap-check после каждого логического блока.
- `npm run check:fast` — быстрый локальный прогон для законченного логического блока: selective checks + `guard:external-links` + ESLint только по изменённым js/ts файлам. ESLint запускается с локальным cache и `--max-warnings=0`, чтобы повторные прогоны были быстрее, а новые warning'и в touched-files не проходили незамеченными.
- `npm run check:fast:dry` — показывает, что именно проверит быстрый scope-прогон, без запуска команд.
- `npm run check:preflight` — расширенный локальный прогон перед PR/крупным завершённым куском: `check:fast` + changed-file complexity guard.
- `npm run check:e2e:changed` — selective Playwright smoke-прогон по changed files для travel/search/map/account/messages.
- `npm run check:e2e:changed:dry` — показывает, какие e2e spec'и будут запущены.
- `npm run check:changed` — локально прогоняет selective schema/validator checks по текущим изменённым файлам в git working tree.
- `npm run check:changed:dry` — показывает, какие selective checks сработают, без запуска самих тестов.
- `npm run check:preflight` — единый selective preflight-runner: один раз определяет changed files и с тем же scope запускает `check:fast`, `guard:file-complexity:changed` и `check:e2e:changed`.
- `npm run hooks:install` — включает репозиторные git hooks (`pre-commit` -> `check:fast`, `pre-push` -> `check:preflight`) через `core.hooksPath=githooks`.
- `githooks/pre-push` передаёт в `check:preflight` текущий upstream branch как `--base-ref`, поэтому push проверяет именно diff коммитов, которые отправляются, а не пустой working tree после commit.
- `npm run governance:verify` — runs external-link guards and governance test suite.
- `npm run guard:external-links` — runs both external-link guards.
- Canonical governance command reference: `docs/TESTING.md#governance-commands`.
- `npm run format` — Prettier.
- `npm run clean` — Expo start with clear cache.
- `npm run reset` — Expo reset cache.
- `npm run check-deps` — dependency checks.
- `npm run check:image-architecture` — enforces image/card architecture rules (also runs in `npm run test:ci`).
- `./build-dev.sh` — full dev web build + deploy to dev server (`DEPLOY=0` to skip deploy).
- `./build-prod.sh [dev|preprod|prod]` — production-mode web export into `dist/<env>`, SEO/public-files post-processing, and deploy to prod server by default (`DEPLOY=0` for build-only, `CLEAN=1` to reinstall deps).

Local selective workflow:

```bash
npm run check:fast
npm run check:fast:dry
npm run check:preflight
npm run check:changed
npm run check:changed:dry
node scripts/run-local-selective-checks.js --base-ref origin/main --dry-run --json
```

Recommended cadence:

- во время мелких правок в рамках одного незавершённого куска логики ничего не гонять после каждого сохранения;
- после завершённого логического блока запускать `npm run check:fast`;
- перед PR или после заметного рефакторинга запускать `npm run check:preflight`;
- если нужен только быстрый просмотр e2e scope без запуска браузера, использовать `npm run check:e2e:changed:dry`;
- один раз на машине после `install` запускать `npm run hooks:install`, чтобы fast/preflight проверки срабатывали автоматически на commit/push;
- перед завершением задачи запускать проверки по scope изменений, как требует `docs/RULES.md`.

## Route point from photo

Flow for adding a route point from a photo on web must stay exactly this way:

1. Read GPS coordinates from EXIF.
2. Reverse geocode coordinates into address and country.
3. Add a new local route point with:
   - `id: null`
   - resolved `address`
   - resolved `country`
   - local photo preview as `blob:...`
4. Save travel via `PUT /api/travels/upsert/`.
5. Backend may require `coordsMeTravel[].image` even for a new point.
   - In this case frontend may send a serializer-compatible fallback image in `upsert`.
   - But frontend must still preserve the local `blob:` preview in local state after save.
6. After backend assigns a real point `id`, frontend must upload the actual point photo via `POST /api/upload` with:
   - `collection=travelImageAddress`
   - `id=<point id>`
7. After upload succeeds, the point image in UI/state must be replaced with the uploaded server URL.

Regression expectations:
- `upsert` must never send `blob:` URLs to backend;
- successful `upsert` must not erase the pending local point photo;
- if backend echoes a fallback image for the point, UI must still keep the local preview until real point-photo upload finishes;
- after the deferred upload finishes, the point must show the uploaded server image and the UI marker card must still indicate that the point has a photo.

## Environment variables

Minimum required for unit tests and local dev:

- `EXPO_PUBLIC_API_URL` — backend base URL.

Optional:

- OpenRouteService key for routing (see `README.md`).

## Project structure (high level)

- `app/` — Expo Router routes/pages.
- `components/` — UI/components.
- `hooks/`, `utils/`, `api/`, `services/` — business logic and utilities.
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
