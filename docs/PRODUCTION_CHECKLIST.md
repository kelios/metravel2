# ✅ Production Release Checklist

## ✅ ИСПРАВЛЕНО - Критичні архітектурні проблеми

### Google Maps заменен на бесплатные альтернативы

- ✅ **Карты без Google Maps API**
  - iOS: Apple Maps (нативные)
  - Android: Google Maps (встроенные в устройство, без API key)
  - Web: OpenStreetMap (бесплатный)
  - См. `docs/MAPS_CONFIGURATION.md`

### SEO/Meta архітектура оптимізована (25.01.2026)

- ✅ **Усунуто дублі meta-тегів**
  - Видалено fallback title/description/canonical з `app/_layout.tsx`
  - Спрощено `InstantSEO.tsx` (тільки декларативний Head)
  - Тепер 1 canonical, 1 description на сторінці
  
- ✅ **Виправлено consent compliance**
  - Видалено `<noscript>` analytics блок (обходив баннер згоди)
  - Analytics запускається ТІЛЬКИ після явної згоди користувача
  
- ✅ **Централізовані SEO утиліти**
  - Новий модуль `utils/seo.ts` з функціями:
    - `getSiteBaseUrl()` — нормалізований base URL
    - `buildCanonicalUrl(pathname)` — правильний canonical
    - `buildOgImageUrl(path)` — правильний OG image URL
  - 21 файл мігровано на нові утиліти
  
- ✅ **Захист від індексації non-prod**
  - `<meta name="robots" content="noindex,nofollow">` на staging/dev
  - Автоматична перевірка hostname у `app/+html.tsx`
  
- ✅ **Fail-fast для analytics**
  - Видалено дефолтні GA/Metrika ID
  - На prod без env змінних аналітика вимкнена (не використовує чужі ID)
  
- 📖 **Документація:** `docs/SEO_MIGRATION.md`

- ✅ **Bundle Identifiers обновлены**
  - iOS: `by.metravel.app`
  - Android: `by.metravel.app`

- ✅ **Секреты удалены из .env.prod**
  - Перенесены в EAS Secrets (см. ниже)

- ✅ **Оптимизация зависимостей**
  - Удалены дубликаты: jspdf, html2pdf.js, pdf-lib
  - Удалены неиспользуемые: lint, format, deprecated-react-native-prop-types

---

## 🔴 КРИТИЧНО - Сделать ДО релиза

- [ ] **EAS Secrets Configuration**
  ```bash
  # Запустите скрипт для настройки секретов:
  ./scripts/setup-eas-secrets.sh
  
  # Или вручную:
  eas secret:create --scope project --name EXPO_PUBLIC_METRIKA_ID --value "YOUR_METRIKA_ID"
  eas secret:create --scope project --name EXPO_PUBLIC_GOOGLE_GA4 --value "YOUR_GA4_ID"
  eas secret:create --scope project --name ROUTE_SERVICE_KEY --value "YOUR_ORS_KEY"
  ```
  - [ ] Получить OpenRouteService API key (бесплатно): https://openrouteservice.org/dev/#/signup
  - [ ] Получить Яндекс Метрика ID: https://metrika.yandex.ru/
  - [ ] Получить Google GA4 ID: https://analytics.google.com/
  - [ ] Настроить через скрипт или вручную

- [ ] **EAS Submit Credentials**
  - [ ] Обновить `eas.json` → `submit.production.ios.appleId` (сейчас: savran.juli@example.com)
  - [ ] Обновить `eas.json` → `submit.production.ios.ascAppId`
  - [ ] Обновить `eas.json` → `submit.production.ios.appleTeamId`
  - [ ] Получить значения из: https://appstoreconnect.apple.com

- [ ] **Android: google-play-service-account.json**
  - [ ] Скачать из Google Play Console
  - [ ] Поместить в корень проекта
  - [ ] Проверить что в .gitignore

- [ ] **Финальная проверка**
  ```bash
  npm run release:check
  ```
  - [ ] Lint passed
  - [ ] Security check passed
  - [ ] Audit passed
  - [ ] Tests passed
  - [ ] Build passed

---

## 🟡 ВАЖНО - Сделать в течение недели

- [ ] **Error Monitoring**
  - [ ] Настроить Sentry
  - [ ] Добавить Crashlytics (Firebase) - опционально
  - [ ] Проверить error boundaries

- [ ] **Testing**
  ```bash
  npm run test:coverage  # Цель: > 60%
  npm run e2e            # Проверить критические пути
  npm run lighthouse     # Цель: Performance > 90
  ```

- [ ] **Performance (локально, mobile + desktop)**
  Цель: зеленый скор (>= 80) на основных страницах.

  ```bash
  # 1) Собрать web (prod export, как в прод-деплое)
  yarn build:web:prod

  # 2) Mobile
  yarn lighthouse:travel:mobile
  LIGHTHOUSE_PATH=/ yarn lighthouse:travel:mobile
  LIGHTHOUSE_PATH=/search yarn lighthouse:travel:mobile
  LIGHTHOUSE_PATH=/map yarn lighthouse:travel:mobile

  # 3) Desktop
  yarn lighthouse:travel:desktop
  LIGHTHOUSE_PATH=/ yarn lighthouse:travel:desktop
  LIGHTHOUSE_PATH=/search yarn lighthouse:travel:desktop
  LIGHTHOUSE_PATH=/map yarn lighthouse:travel:desktop
  ```

  Примечания:
  - Порог можно повысить через `LIGHTHOUSE_MIN_SCORE=0.9`
  - Любую страницу можно проверить через `LIGHTHOUSE_PATH=/нужная-страница`

  После деплоя на prod (для сравнения с PageSpeed Insights):

  ```bash
  # Default URL is built into the script.
  yarn lighthouse:produrl:travel:mobile
  yarn lighthouse:produrl:travel:desktop

  # Override target URL (recommended):
  LIGHTHOUSE_URL=https://metravel.by/travels/tropa-vedm-harzer-hexenstieg-kak-proiti-marshrut-i-kak-eto-vygliadit-na-samom-dele yarn lighthouse:produrl:travel:mobile
  LIGHTHOUSE_URL=https://metravel.by/travels/tropa-vedm-harzer-hexenstieg-kak-proiti-marshrut-i-kak-eto-vygliadit-na-samom-dele yarn lighthouse:produrl:travel:desktop

  yarn lighthouse:produrl:summary
  yarn lighthouse:produrl:lcp
  ```

- [ ] **Analytics**
  - [ ] Настроить Google Analytics 4 (ключ уже в .env)
  - [ ] Настроить Yandex Metrika (ID уже в .env)
  - [ ] Проверить event tracking

---

## 🟢 ЖЕЛАТЕЛЬНО - Сделать в течение месяца

- [ ] **Performance**
  - [ ] Lazy load react-native-maps
  - [ ] Lazy load @react-pdf/renderer
  - [ ] Lazy load react-quill
  - [ ] Измерить bundle size до/после

- [ ] **Documentation**
  - [ ] Создать CHANGELOG.md
  - [ ] Обновить API documentation
  - [ ] Добавить troubleshooting guide

- [ ] **Monitoring**
  - [ ] Dashboard для метрик (Grafana/DataDog)
  - [ ] Alerts для critical errors
  - [ ] Uptime monitoring (Pingdom/UptimeRobot)

- [ ] **Rollback Plan**
  - [ ] Документировать процесс отката версии
  - [ ] Подготовить hot-fix процедуру
  - [ ] Настроить feature flags

---

## 📱 Релиз по платформам

### iOS
```bash
npm run ios:prebuild       # Проверка
npm run ios:build:prod     # Сборка
npm run ios:submit:latest  # Отправка в App Store
```

### Android
```bash
npm run android:prebuild       # Проверка
npm run android:build:prod     # Сборка (AAB)
npm run android:submit:latest  # Отправка в Google Play
```

### Web
```bash
npm run prod:web  # Production build
# Деплой согласно вашему hosting provider
```

---

## 📊 Post-Release Monitoring

**Первые 24 часа:**
- [ ] Crash rate < 1%
- [ ] API errors < 1%
- [ ] App load time < 3s
- [ ] No critical bugs reported
- [ ] **SEO перевірки:**
  - [ ] View Page Source → 1 canonical, 1 description (no duplicates)
  - [ ] Staging має `robots: noindex,nofollow`
  - [ ] Analytics не запускається без consent
  - [ ] PageSpeed Insights SEO Score ≥ 95

**Первая неделя:**
- [ ] User retention D1 > 40%
- [ ] No critical security issues
- [ ] Performance metrics stable
- [ ] Customer feedback positive

---

## 🎯 Быстрые команды

```bash
# Проверка перед релизом
npm run release:check

# Настройка секретов
./scripts/setup-eas-secrets.sh

# Проверка EAS
eas whoami
eas secret:list

# Сборка всех платформ
npm run build:all:prod
```

---

**Последнее обновление:** 3 января 2026  
**Статус:** ✅ Google Maps проблемы исправлены, зависимости оптимизированы  
**См. полный отчет:** `PRODUCTION_READINESS_REPORT.md`
