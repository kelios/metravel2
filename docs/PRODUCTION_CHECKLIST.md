# ✅ Production Release Checklist

- [ ] **Финальная проверка**
  ```bash
  npm run release:check
  ```
- [ ] **Policy guards (external links)**
  ```bash
  npm run guard:external-links
  ```
- [ ] **Governance verification**
  ```bash
  npm run governance:verify
  ```
- [ ] **Canonical governance reference:** `docs/TESTING.md#governance-commands`
- [ ] **Testing**
  ```bash
  npm run test:coverage  # Цель: > 60%
  npm run e2e            # Критические пути
  ```

- [ ] **Performance (mobile + desktop)**

  Целевые скоры: Desktop ≥ 70, Mobile ≥ 60.

  ```bash
  # Desktop:
  npx lighthouse https://metravel.by/ --preset=desktop --only-categories=performance --chrome-flags="--headless --no-sandbox"

  # Mobile:
  npx lighthouse https://metravel.by/ --form-factor=mobile --screenEmulation.mobile --throttling.cpuSlowdownMultiplier=4 --only-categories=performance --chrome-flags="--headless --no-sandbox"
  ```

  Для локальных билдов:
  ```bash
  npm run build:web:prod
  npx serve dist/prod -l 3000 -s
  ```

  Yarn-скрипты:
  ```bash
  yarn lighthouse:travel:mobile
  yarn lighthouse:travel:desktop
  yarn lighthouse:produrl:travel:mobile
  yarn lighthouse:produrl:travel:desktop
  yarn lighthouse:produrl:summary
  ```

## 📱 Релиз по платформам

### iOS
```bash
npm run ios:prebuild
npm run ios:build:prod
npm run ios:submit:latest
```

### Android
```bash
npm run android:prebuild
npm run android:build:prod
npm run android:submit:latest
```

### Web
```bash
npm run prod:web
```

---

## 📊 Post-Release Monitoring

**Первые 24 часа:**
- [ ] Crash rate < 1%
- [ ] API errors < 1%
- [ ] App load time < 3s
- [ ] No critical bugs reported
- [ ] Post-deploy SEO audit
  ```bash
  npm run test:seo:postdeploy
  ```
- [ ] SEO: 1 canonical, 1 description (no duplicates)
- [ ] Staging: `robots: noindex,nofollow`
- [ ] Analytics не запускается без consent
- [ ] PageSpeed SEO Score ≥ 95

**Первая неделя:**
- [ ] User retention D1 > 40%
- [ ] No critical security issues
- [ ] Performance metrics stable

---

## 🎯 Быстрые команды

```bash
npm run release:check       # Проверка перед релизом
eas whoami                  # Проверка EAS
eas secret:list             # Секреты
npm run build:all:prod      # Сборка всех платформ
```

---

**Последнее обновление:** 2 марта 2026  
**Статус:** ✅ Все проверки пройдены, проект готов к деплою
