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
- [ ] **Canonical governance reference checked:** `docs/TESTING.md#governance-commands`
- [ ] **Testing**
  ```bash
  npm run test:coverage  # Цель: > 60%
  npm run e2e            # Проверить критические пути
  npm run lighthouse     # Цель: Performance > 90
  ```

- [ ] **Performance (mobile + desktop)**
  Цель: Desktop ≥ 70, Mobile ≥ 60 на основных страницах (/, /search, /map).

  Тестируй напрямую на `https://metravel.by`:

  ```bash
  # Desktop:
  npx lighthouse https://metravel.by/ --preset=desktop --only-categories=performance --chrome-flags="--headless --no-sandbox"
  npx lighthouse https://metravel.by/search --preset=desktop --only-categories=performance --chrome-flags="--headless --no-sandbox"
  npx lighthouse https://metravel.by/map --preset=desktop --only-categories=performance --chrome-flags="--headless --no-sandbox"

  # Mobile:
  npx lighthouse https://metravel.by/ --form-factor=mobile --screenEmulation.mobile --throttling.cpuSlowdownMultiplier=4 --only-categories=performance --chrome-flags="--headless --no-sandbox"
  npx lighthouse https://metravel.by/search --form-factor=mobile --screenEmulation.mobile --throttling.cpuSlowdownMultiplier=4 --only-categories=performance --chrome-flags="--headless --no-sandbox"
  npx lighthouse https://metravel.by/map --form-factor=mobile --screenEmulation.mobile --throttling.cpuSlowdownMultiplier=4 --only-categories=performance --chrome-flags="--headless --no-sandbox"
  ```

  Для **локальных билдов** (до деплоя) — serve через Network IP (не `localhost`, CORS блокирует):
  ```bash
  npm run build:web:prod
  npx serve dist/prod -l 3000 -s
  # Используй Network IP из вывода, например http://192.168.50.10:3000
  ```

  Также можно использовать yarn-скрипты:
  ```bash
  yarn lighthouse:travel:mobile
  LIGHTHOUSE_PATH=/ yarn lighthouse:travel:mobile
  LIGHTHOUSE_PATH=/search yarn lighthouse:travel:mobile
  LIGHTHOUSE_PATH=/map yarn lighthouse:travel:mobile
  yarn lighthouse:travel:desktop
  LIGHTHOUSE_PATH=/ yarn lighthouse:travel:desktop
  LIGHTHOUSE_PATH=/search yarn lighthouse:travel:desktop
  LIGHTHOUSE_PATH=/map yarn lighthouse:travel:desktop
  ```

  Примечания:
  - Если порт 3000 занят: `lsof -ti:3000 | xargs kill -9`
  - Для сохранения отчёта: `--output=json --output-path=/tmp/lh-report.json`
  - Порог можно повысить через `LIGHTHOUSE_MIN_SCORE=0.9`

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

**Последнее обновление:** 2 марта 2026  
**Статус:** ✅ Все проверки пройдены, проект готов к деплою
