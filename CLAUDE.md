# CLAUDE.md — MeTravel Project Context

## Краткое описание

MeTravel — кросс-платформенное туристическое приложение (iOS, Android, Web).
Монорепо: только фронтенд (React Native + Expo). Бэкенд — отдельный сервис.

---

## Стек технологий

| Слой | Технология |
|------|-----------|
| UI-фреймворк | React 19, React Native 0.84, Expo 55 |
| Навигация | Expo Router 55 (file-based, как Next.js) |
| Web | React Native Web + Metro bundler |
| Серверный стейт | TanStack React Query 5 |
| Клиентский стейт | Zustand 5 |
| Карты (web) | Leaflet 1.9 + React Leaflet |
| Карты (native) | React Native Maps + Apple Maps |
| Анимации | React Native Reanimated 4 |
| Формы/валидация | yup |
| Типизация | TypeScript 5.7, strict mode |
| Тесты (unit) | Jest 29 + @testing-library |
| Тесты (e2e) | Playwright 1.49 |
| Линтер | ESLint 9 (FlatConfig) |
| Форматирование | Prettier 3 (no semicolons, single quotes) |
| Билд | EAS Build (Expo Application Services) |
| Пакетный менеджер | yarn 1.22 |

---

## Структура проекта

```
app/              # Экраны (Expo Router, file-based routing)
  (tabs)/         # Таб-навигация
components/       # React-компоненты, организованы по фиче
  ui/             # Переиспользуемые UI-компоненты (Image, Card и т.д.)
  common/         # Общие компоненты
  layout/         # Лейаут-компоненты
  article/        # Компоненты для статей
  travel/         # Компоненты для путешествий
  map/            # Компоненты карт
hooks/            # Кастомные React hooks
utils/            # Утилиты и хелперы
api/              # API-клиент и TanStack Query hooks
stores/           # Zustand stores (8 stores)
context/          # React Context (AuthContext, FavoritesContext и др.)
assets/           # Изображения, шрифты, иконки
constants/        # Константы приложения
types/            # TypeScript типы
styles/           # Глобальные CSS
config/           # Конфигурационные файлы
scripts/          # Build и dev скрипты
docs/             # Документация проекта
__tests__/        # Jest unit-тесты
e2e/              # Playwright e2e-тесты
plugins/          # Expo плагины
public/           # Статика (robots.txt, sitemap.xml)
```

---

## Команды

### Разработка
```bash
npm start              # Expo dev server
npm run web            # Web dev mode
npm run ios            # iOS симулятор
npm run android        # Android эмулятор
npm run clean          # Очистка кэша
npm run reset          # Полный сброс кэша
```

### Сборка
```bash
npm run build:web      # Продакшн-сборка для web → dist/prod/
npm run build:web:prod # Полная сборка с SEO-страницами
npm run ios:build:prod # iOS через EAS
npm run android:build:prod # Android через EAS
```

### Тесты
```bash
npm run test           # Jest в watch-режиме
npm run test:run       # Один прогон Jest
npm run test:coverage  # Coverage report
npm run e2e            # Playwright (headless)
npm run e2e:headed     # Playwright с UI
npm run test:smoke:critical # Smoke-тесты критических путей
```

### Качество кода
```bash
npm run lint           # ESLint
npm run typecheck      # TypeScript проверка
npm run format         # Prettier
npm run guard:external-links  # Проверка прямых вызовов Linking.openURL
npm run check:image-architecture # Проверка архитектуры изображений
```

### Релиз
```bash
npm run release:check  # Полная проверка (lint + tests + build + audit + e2e)
```

---

## Правила редактирования кода

### Обязательно
- Все изображения в фичевых компонентах — только через `components/ui/ImageCardMedia.tsx`
- Travel-карточки — только через `components/ui/UnifiedTravelCard.tsx`
- Внешние ссылки — только через `@/utils/externalLinks.openExternalUrl`, **не** `Linking.openURL()`
- Серверный стейт — TanStack React Query (файлы `api/*/Queries.ts`)
- Клиентский стейт — Zustand (`stores/`)
- Импорты через алиас `@/` (маппинг на корень проекта)

### Стиль кода
- TypeScript strict, новый `any` запрещён в `api/`, `hooks/`, `stores/`
- Prettier: no semicolons, single quotes, JSX brackets on same line
- React Native Web совместимость для всех компонентов, используемых на web

### Что не нужно делать
- Не добавлять docstrings/комментарии к нетронутому коду
- Не вводить error handling для невозможных сценариев
- Не создавать абстракции для одноразовых операций
- Не добавлять backwards-compatibility костыли

---

## Что нельзя трогать без явного запроса

- `eas.json` — конфиги EAS-билдов (iOS/Android сертификаты, треки дистрибуции)
- `app.json` — bundle IDs, app version, Expo плагины
- `.github/workflows/` — CI/CD пайплайны
- `nginx/` — конфиги веб-сервера
- `plugins/` — кастомные Expo плагины
- `scripts/` — билд-скрипты и SEO-генераторы
- `public/robots.txt`, `public/sitemap.xml` — SEO-конфиги
- `entry.js` — точка входа приложения

---

## Бэкенд и окружение

- API базовый URL: `EXPO_PUBLIC_API_URL` (прод: `https://metravel.by`)
- Авторизация: `Authorization: Token <token>`
- Env-файлы: `.env`, `.env.dev`, `.env.prod`, `.env.e2e`, `.env.preprod`
- Локальный API: `EXPO_PUBLIC_IS_LOCAL_API=true`
- Карты (routing): `EXPO_PUBLIC_ORS_API_KEY` (OpenRouteService, опционально)
- Авторизованный QA: можно логиниться тестовым e2e-аккаунтом из `.env.e2e` (`E2E_EMAIL`/`E2E_PASSWORD`) через e2e-механизм (Playwright auth setup или программный логин: login API → `Authorization: Token`), без ручного ввода пароля в поля и без вывода секретов в логи/скрины. Только для локального/preview QA, без деструктивных действий.
- Всегда проверять самому: агент сам верифицирует свои изменения (браузер/тесты) до сдачи — не перекладывать проверку на пользователя и не отмечать «готово/исправлено», пока верификация не завершена. Если preview/dev-сервер нестабилен (краши, медленный бандл, редиректы, таймауты API) — перезапускать, ждать, повторять до фактической проверки; нестабильность не повод пропускать верификацию. Если проверить реально невозможно из-за внешнего блокера — явно указать `verify pending` с конкретной причиной.

---

## Секреты и ключи (правило обращения)

**Никогда не проси пользователя вставлять секреты (приватные ключи, токены, пароли,
service-account JSON) в чат.** Вместо этого:

1. **Дай инструкцию, КУДА положить ключ самому** — точный путь к gitignored-файлу
   (`.secrets/<имя>.json`) или имя env-переменной. Пользователь кладёт файл сам, в чат
   не присылает.
2. **Перед использованием убедись, что путь в `.gitignore`** (`git check-ignore <path>`).
   Каталог `.secrets/`, `*.gcp.json`, `gcp-service-account*.json` уже игнорируются.
3. **Код читает ключ из файла/env**, не хардкодит — замена/ротация ключа = просто заменить
   файл, без правок кода (см. `scripts/lib/google-auth.js`).
4. **Если секрет всё же был показан в чате** — он считается утёкшим: явно скажи это и
   поставь задачу на ротацию (удалить старый, выпустить новый).
5. **Не логируй секреты** (echo/cat ключа, печать токена). В выводе — только статусы.

Текущие ключи: Google service-account → `.secrets/gcp-service-account.json`
(скрипты `npm run stats:gsc` / `stats:ga4`).

---

## Важные архитектурные правила

1. **Image компоненты**: прямой импорт `expo-image` в фичевые компоненты запрещён ESLint-гвардом
2. **External links**: ESLint-гвард запрещает `Linking.openURL` напрямую
3. **Сложность файлов**: `npm run guard:file-complexity` следит за размером файлов
4. **Тесты исключены из coverage**: Map-компоненты, image upload, ArticleEditor, GalleryLayout
5. **iOS Safari + `ImageCardMedia` (contain + `allowCriticalWebBlur`)**: НЕ показывать главное
   изображение до завершения декода на iPhone/iPad Safari. WebKit рисует «размытый
   прогрессивный кадр» у contain-карточек с общим blur, если открыть `<img>` до `onLoad`
   (виднее всего на крупной карточке «Маршрут недели»). `priority="high"` НЕ должен
   обходить эту защиту — он лишь задаёт `fetchPriority`, но reveal всё равно ждёт декод
   (см. `shouldShowWebImageImmediately` в `components/ui/ImageCardMedia.tsx`). Featured- и
   popular-карточки обязаны вести себя одинаково по reveal; различаться можно только
   `quality`/`loading`/`fetchPriority`, но не моментом показа sharp-кадра.

---

## Git-правила

- Работать только в ветке `main`
- Не создавать новые ветки
- Не использовать git worktrees
- Все изменения вносить напрямую в `main` из `/Users/juliasavran/Sites/metravel2/metravel2`
- Коммитить всегда из директории основного репозитория (не из worktree-пути)

---

## Skills для агентского workflow

- Полная карта skills и сценариев их выбора живёт в `docs/CODEX.md`.
- `$metravel-hook-builder` — используй, когда задача в основном состоит в выносе или упрощении focused React hooks, cleanup hook-границ и сохранении текущих public contracts.
- `$metravel-quality-fixer` — используй, когда задача состоит в полном прогоне lint/Jest/Playwright, исправлении найденных падений и повторной валидации до зелёного baseline.
- `$metravel-code-reviewer` — используй для focused review diff'а перед handoff: поиск рисков, rule violations, validation gaps и residual risk.

---

## Стиль ответов Claude в этом проекте

1. Сначала короткий план (2-5 пунктов) — что и где меняется
2. Затем изменения кода
3. Без повторения условия задачи
4. Без trailing summary ("итак, я сделал...")
5. Ссылки на файлы в формате `path/to/file.tsx:line`
