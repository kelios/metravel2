# ✅ Production Release Checklist
- [ ] **Финальная проверка**
  ```bash
  npm run release:check
  ```
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
**См. полный отчет:** `docs/PRODUCTION_READINESS_REPORT.md`
