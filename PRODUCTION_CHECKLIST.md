# ✅ Production Release Checklist

## ✅ ИСПРАВЛЕНО - Google Maps заменен на бесплатные альтернативы

- ✅ **Карты без Google Maps API**
  - iOS: Apple Maps (нативные)
  - Android: Google Maps (встроенные в устройство, без API key)
  - Web: OpenStreetMap (бесплатный)
  - См. `docs/MAPS_CONFIGURATION.md`

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
  eas secret:create --scope project --name ROUTE_SERVICE_KEY --value "YOUR_ORS_KEY"
  ```
  - [ ] Получить OpenRouteService API key (бесплатно): https://openrouteservice.org/dev/#/signup
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

