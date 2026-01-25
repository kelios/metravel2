# Тестирование Страницы Путешествия - До/После Оптимизации

## 🎯 Цель
Проверить улучшение PageSpeed показателей для страницы путешествия:
https://metravel.by/travels/tropa-vedm-harzer-hexenstieg-kak-proiti-marshrut-i-kak-eto-vygliadit-na-samom-dele

---

## ✅ Что Было Оптимизировано

### **1. Hero Image (LCP Optimization)**
- ✅ Качество: 50→65 (mobile), 55→70 (desktop)
- ✅ Формат: webp→auto (поддержка AVIF)
- ✅ Srcset: больше размеров для responsive images
- ✅ Alt text: улучшен для SEO и accessibility

### **2. Общие Оптимизации** 
- ✅ Service Worker с кешированием
- ✅ Brotli compression
- ✅ Critical CSS inline
- ✅ Font preloading
- ✅ Resource hints (dns-prefetch, preconnect)

---

## 🧪 Как Протестировать

### **Шаг 1: Сборка Production**
```bash
cd /Users/juliasavran/Sites/metravel2/metravel2
npm run build:web:prod
```

### **Шаг 2: Автоматическое Тестирование**

Запустите автоматический тест (mobile + desktop):
```bash
npm run test:travel:performance
```

Это создаст:
- `lighthouse-reports/mobile-[timestamp].html` - детальный отчет mobile
- `lighthouse-reports/desktop-[timestamp].html` - детальный отчет desktop
- `lighthouse-reports/performance-[timestamp].json` - JSON с метриками

### **Шаг 3: Тестирование Production URL**

После деплоя на сервер тестируйте production URL:

**Manual Test:**
1. Откройте https://pagespeed.web.dev/
2. Вставьте URL: `https://metravel.by/travels/tropa-vedm-harzer-hexenstieg-kak-proiti-marshrut-i-kak-eto-vygliadit-na-samom-dele`
3. Проверьте оба таба: Mobile и Desktop

**Automated Test:**
```bash
# Для конкретного URL
LIGHTHOUSE_URL=https://metravel.by/travels/tropa-vedm-harzer-hexenstieg-kak-proiti-marshrut-i-kak-eto-vygliadit-na-samom-dele \
npm run test:travel:performance
```

---

## 📊 Ожидаемые Результаты

### До Оптимизации
| Метрика | Desktop | Mobile |
|---------|---------|--------|
| Performance | 46 🔴 | 62 🟠 |
| Accessibility | 78 🟠 | 100 🟢 |
| LCP | ~4500ms | ~5200ms |
| CLS | ~0.15 | ~0.18 |

### После Оптимизации (Цель)
| Метрика | Desktop | Mobile |
|---------|---------|--------|
| Performance | **90-95** 🟢 | **85-92** 🟢 |
| Accessibility | **95-100** 🟢 | **100** 🟢 |
| LCP | **<2500ms** | **<3000ms** |
| CLS | **<0.1** | **<0.1** |

---

## 🔍 Что Проверять в Отчетах

### **1. Performance Score (90+)**
- ✅ FCP (First Contentful Paint) < 1.8s
- ✅ LCP (Largest Contentful Paint) < 2.5s
- ✅ TBT (Total Blocking Time) < 300ms
- ✅ CLS (Cumulative Layout Shift) < 0.1
- ✅ Speed Index < 3.4s

### **2. Accessibility Score (90+)**
- ✅ All images have alt text
- ✅ Color contrast ≥ 4.5:1
- ✅ ARIA labels present
- ✅ Focus indicators visible
- ✅ Semantic HTML structure

### **3. Best Practices (90+)**
- ✅ HTTPS enabled
- ✅ Images properly sized
- ✅ No console errors
- ✅ Cache policy set

### **4. LCP Element Analysis**
В Lighthouse отчете найдите "Largest Contentful Paint element":
- Должно быть hero image
- Должно загружаться как WebP/AVIF
- Должно иметь `fetchpriority="high"`

---

## 📈 Сравнение Результатов

### Использование JSON отчета
```bash
# Посмотреть метрики
cat lighthouse-reports/performance-*.json | jq '.mobile.performance'
cat lighthouse-reports/performance-*.json | jq '.desktop.performance'

# Сравнить LCP
cat lighthouse-reports/performance-*.json | jq '.mobile.metrics.lcp'
cat lighthouse-reports/performance-*.json | jq '.desktop.metrics.lcp'
```

---

## 🐛 Troubleshooting

### Низкий Performance Score (<90)

**Проверьте:**
1. Hero image действительно загружается как AVIF/WebP:
   ```
   DevTools → Network → Filter:Img → Проверьте type
   ```

2. Service Worker активен:
   ```
   DevTools → Application → Service Workers
   ```

3. Brotli compression работает:
   ```
   DevTools → Network → Response Headers → content-encoding: br
   ```

4. Cache headers правильные:
   ```
   DevTools → Network → Response Headers → cache-control
   ```

### Низкий Accessibility Score (<90)

**Проверьте:**
1. Все изображения имеют alt:
   ```javascript
   document.querySelectorAll('img:not([alt])')
   ```

2. Цветовой контраст:
   ```
   DevTools → Lighthouse → View Trace → Accessibility Issues
   ```

### Высокий LCP (>2.5s)

**Причины:**
- Медленный сервер (проверьте TTFB)
- Большое изображение (уменьшите quality/размер)
- Нет preload для hero image
- Медленный CDN

**Решение:**
```typescript
// В TravelDetailsHero.tsx
const lcpQuality = isMobile ? 55 : 60 // Уменьшить еще
```

---

## 📋 Checklist Деплоя

Перед деплоем убедитесь:

- [ ] `npm run build:web:prod` успешно завершился
- [ ] Локальные Lighthouse тесты прошли (90+)
- [ ] Все файлы из `dist/prod/*` готовы к деплою
- [ ] `.htaccess` включен в деплой
- [ ] `sw.js` и `manifest.json` в корне сайта

После деплоя:

- [ ] Откройте сайт в Incognito
- [ ] Проверьте DevTools Console (нет ошибок)
- [ ] Запустите PageSpeed Insights
- [ ] Проверьте на реальном мобильном устройстве

---

## 🎯 Quick Commands

```bash
# Полный цикл тестирования
npm run build:web:prod && npm run test:travel:performance

# Только mobile тест
LIGHTHOUSE_FORM_FACTOR=mobile npm run lighthouse:travel:mobile

# Только desktop тест
LIGHTHOUSE_FORM_FACTOR=desktop npm run lighthouse:travel:desktop

# Production URL тест
LIGHTHOUSE_URL=https://metravel.by/travels/your-slug \
npm run test:travel:performance
```

---

## 📞 Поддержка

Если результаты не достигают 90+:

1. **Проверьте все оптимизации применены:**
   - Посмотрите Network tab (AVIF/WebP загружаются?)
   - Проверьте Service Worker (зарегистрирован?)
   - Проверьте compression (Brotli работает?)

2. **Откройте HTML отчет:**
   ```bash
   open lighthouse-reports/mobile-*.html
   open lighthouse-reports/desktop-*.html
   ```

3. **Посмотрите конкретные рекомендации:**
   - В отчете секция "Opportunities"
   - В отчете секция "Diagnostics"

4. **Профилируйте страницу:**
   ```
   DevTools → Performance → Record page load
   ```

---

## ✅ Success Criteria

Тест считается успешным если:

- ✅ Desktop Performance ≥ 90
- ✅ Mobile Performance ≥ 85
- ✅ Accessibility ≥ 95 (desktop & mobile)
- ✅ LCP < 2.5s (desktop), < 3.0s (mobile)
- ✅ CLS < 0.1
- ✅ Нет критичных ошибок в Console

---

## 📚 Дополнительные Ресурсы

- [PERFORMANCE_OPTIMIZATION.md](./docs/PERFORMANCE_OPTIMIZATION.md) - Полная документация
- [PAGESPEED_CHECKLIST.md](./PAGESPEED_CHECKLIST.md) - Быстрый чеклист
- [web.dev](https://web.dev/vitals/) - Core Web Vitals guide
