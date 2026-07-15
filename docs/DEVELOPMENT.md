# Development guide

## Project root

- Current project: `metravel2`
- Run all commands from the `metravel2/` app root (this folder contains `package.json`).

## Setup

```bash
nvm install
nvm use
corepack enable
corepack prepare yarn@1.22.22 --activate
yarn install --frozen-lockfile
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

Android QA rule:

- `npm run android` only starts the Expo/Metro Android dev flow; it is not sufficient Android device validation by itself.
- For Android testing, assume the phone is connected by USB, run `adb devices -l`, build locally, install to the device, and test that installed build. Default local commands are `cd android && ./gradlew :app:installDebug` or `:app:assembleDebug` followed by `adb install -r android/app/build/outputs/apk/debug/app-debug.apk`.
- Do not run Android EAS/cloud builds, Android production builds/submits, or use Expo export/dev-client as the Android QA path unless the user explicitly asks for that exact Android build path.

## Useful scripts

- `npm run lint` — ESLint.
- `npm run typecheck` — полный TypeScript audit (`tsc --noEmit`). Сейчас это отдельная проверка долга, а не cheap-check после каждого логического блока.
- `npm run typecheck:e2e` — non-emitting TypeScript audit всех Playwright specs из `e2e/**/*.ts`.
- `npm run guard:type-debt` — запрещает рост `as any`, `@ts-ignore`, `@ts-expect-error` и `eslint-disable` по production-доменам и файлам относительно `scripts/type-debt-baseline.json`; `guard:type-debt:update` допустим только после явного review причины нового baseline.
- `npm run test:i18n` — unit- и governance-проверки locale registry, переводов, форматтеров и отсутствия новых hardcoded UI-строк.
- `npm run check:fast` — быстрый локальный прогон для законченного логического блока: selective checks + `guard:external-links` + `guard:type-debt` + ESLint только по изменённым js/ts файлам. ESLint запускается с локальным cache и `--max-warnings=0`, чтобы повторные прогоны были быстрее, а новые warning'и в touched-files не проходили незамеченными.
- `npm run check:fast:dry` — показывает, что именно проверит быстрый scope-прогон, без запуска команд.
- `npm run check:preflight` — единый selective preflight-runner перед PR/крупным завершённым куском: один раз определяет changed files и с тем же scope запускает `check:fast`, `guard:file-complexity:changed` и `check:e2e:changed`.
- `npm run check:e2e:changed` — selective Playwright smoke-прогон по changed files для travel/search/map/account/messages.
- `npm run check:e2e:changed:dry` — показывает, какие e2e spec'и будут запущены.
- `npm run check:changed` — локально прогоняет selective schema/validator checks по текущим изменённым файлам в git working tree.
- `npm run check:changed:dry` — показывает, какие selective checks сработают, без запуска самих тестов.
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

## Localization

Production UI поддерживает русский, белорусский, украинский, польский и английский
через общий i18n-слой:

- `i18n/config.ts` — locale registry, системная локаль native и детерминированная
  стартовая локаль web SSR/hydration;
- `i18n/LocaleProvider.tsx` — активная локаль, сохранённое предпочтение и `lang`/`dir` документа;
- `i18n/locales/<locale>/` — языковые ресурсы по доменам;
- `i18n/format.ts` — даты, числа, валюты, списки, relative time и сортировка;
- `types/i18next.d.ts` — строгая типизация ключей.

Web-сборка подставляет компактный RU/BE/UK/PL/EN набор для каждого используемого
ключа во время Babel-трансформации (`i18n/babel-inline-plugin.js`) и использует лёгкие
`*.web.ts(x)` runtime-модули. Полные locale-каталоги не возвращаются в общий
web-chunk. Native и Jest работают через полный i18next resource contract.
Статический web HTML остаётся русским baseline для детерминированного SSR и
hydration; сохранённый явный выбор применяется после hydration и синхронизирует
`lang`/`dir`. Новый пользователь начинает с русского. Режим системного языка
включается только явным выбором в настройках.

Для нового UI используй `useTranslation()` из `@/i18n` внутри компонента. В
не-React helper допустимы `translate()`/`getFixedTranslator()`. Не вычисляй
перевод один раз при импорте модуля: статические справочники делай factory-функцией
или getter-свойствами, чтобы смена языка обновляла результат. Даты, числа и
`localeCompare` не должны содержать `ru-RU` напрямую — используй `i18n/format.ts`.

Чтобы добавить язык:

1. Добавь locale в `LOCALE_REGISTRY` и отдельный полный набор ресурсов в
   `i18n/locales/<locale>/` с теми же namespace/key, что у русского baseline;
   экспорт набора оберни в `defineLocaleResources()` для compile-time проверки.
2. Подключи ресурсы в `i18n/resources.ts`; TypeScript должен выявить пропущенные
   или неверные ключи до runtime.
3. Убедись, что общий `LanguageSwitcher` в header и `LanguageSection` в settings
   используют `useLocale()`; storage contract версионирован и поддерживает
   explicit/system режимы.
4. Проверь web `lang`/`dir`, SEO locale, plural forms, Intl formatting и native
   cold restart. Первый client render должен совпадать с locale статического HTML;
   сохранённый выбор применяется после hydration. Для locale-specific URL/hreflang
   сначала нужен отдельный SEO-контракт — текущие canonical URL остаются без
   языкового префикса.
5. Запусти `npm run test:i18n`, затем проверки по общему scope.

Не переводятся на клиенте: пользовательский и редакционный контент из API,
названия мест от backend/geocoder, сообщения/комментарии и стабильные API-коды.
Для локализуемых backend-справочников нужен стабильный code/id и отдельный display
label; сравнивать бизнес-логику с русской подписью запрещено.

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
- Production `sitemap.xml` генерируется backend-ом. Не добавляй генерацию sitemap во frontend build/deploy pipeline; фронт отвечает за page-level meta, canonical, OG/Twitter и JSON-LD.
