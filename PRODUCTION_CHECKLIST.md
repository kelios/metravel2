# ✅ Production Release Checklist

## 🔴 КРИТИЧНО - Сделать ДО релиза

- [ ] **Google Maps API Key**
  - [ ] Получить ключ на https://console.cloud.google.com
  - [ ] Заменить в `app.json` (строки 36, 50)
  - [ ] Включить Maps SDK для iOS и Android

- [ ] **EAS Credentials**
  - [ ] Заполнить `eas.json` → `submit.production.ios.appleId`
  - [ ] Заполнить `eas.json` → `submit.production.ios.ascAppId`
  - [ ] Заполнить `eas.json` → `submit.production.ios.appleTeamId`

- [ ] **Bundle Identifiers**
  - [ ] Проверить iOS: `com.yourcompany.metravel` → изменить на реальный
  - [ ] Проверить Android: `com.yourcompany.metravel` → изменить на реальный

- [ ] **Секреты → EAS Secrets**
  ```bash
  eas secret:create --scope project --name GOOGLE_API_SECRET --value "YOUR_VALUE"
  eas secret:create --scope project --name ROUTE_SERVICE --value "YOUR_VALUE"
  ```
  - [ ] Удалить из `.env.prod` после переноса

- [ ] **Android: google-services.json**
  - [ ] Скачать из Firebase Console
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

- [ ] **Оптимизация зависимостей**
  ```bash
  npm uninstall lint format deprecated-react-native-prop-types
  # Выбрать ОДНУ PDF библиотеку (рекомендуется @react-pdf/renderer)
  npm uninstall jspdf html2pdf.js pdf-lib
  ```

- [ ] **Error Monitoring**
  - [ ] Настроить Sentry
  - [ ] Добавить Crashlytics (Firebase)
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
  - [ ] Обновить README с production инструкциями
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

**Последнее обновление:** 3 января 2026  
**См. полный отчет:** `PRODUCTION_READINESS_REPORT.md`

