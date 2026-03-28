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

---

## Важные архитектурные правила

1. **Image компоненты**: прямой импорт `expo-image` в фичевые компоненты запрещён ESLint-гвардом
2. **External links**: ESLint-гвард запрещает `Linking.openURL` напрямую
3. **Сложность файлов**: `npm run guard:file-complexity` следит за размером файлов
4. **Тесты исключены из coverage**: Map-компоненты, image upload, ArticleEditor, GalleryLayout

---

## Git-правила

- Работать только в ветке `main`
- Не создавать новые ветки
- Все изменения вносить напрямую в `main`

---

## Стиль ответов Claude в этом проекте

1. Сначала короткий план (2-5 пунктов) — что и где меняется
2. Затем изменения кода
3. Без повторения условия задачи
4. Без trailing summary ("итак, я сделал...")
5. Ссылки на файлы в формате `path/to/file.tsx:line`
