# 🚀 Быстрый старт после оптимизации

## Что нужно сделать прямо сейчас

### 1. Очистите кеш TypeScript
```bash
cd /Users/juliasavran/Sites/metravel2/metravel2

# Очистка кеша
npm run clean

# Или полная перезагрузка
npm run reset
```

### 2. Запустите приложение
```bash
npm run web
```

### 3. Проверьте оптимизации

Откройте `http://localhost:8081` и проверьте:
- ✅ Плавность скролла главной страницы
- ✅ Fade-in анимации секций
- ✅ Работу изображения книги (lazy loading)
- ✅ Кнопки (hover эффекты на desktop)
- ✅ FAQ секцию (открытие/закрытие)

---

## 📊 Проверка производительности

### Lighthouse Audit
```bash
# 1. Запустите prod build
npm run web:prod

# 2. Откройте браузер Chrome
# 3. DevTools > Lighthouse
# 4. Запустите audit для "Performance"

Целевые метрики:
- Performance: 90+
- Accessibility: 95+
- Best Practices: 95+
- SEO: 90+
```

### Bundle Size Analysis
```bash
# Создайте production build
npm run build:web

# Анализ размера бандла
npx source-map-explorer 'dist-web/**/*.js'
```

---

## 🐛 Если возникли ошибки

### "Cannot find name 'memo'" или "Cannot find name 'useCallback'"

**Решение:**
```bash
# Полная переустановка зависимостей
rm -rf node_modules
rm package-lock.json
npm install

# Очистка кеша
npm run clean
```

### Ошибки TypeScript

**Решение:**
```bash
# Перезапуск TypeScript сервера в IDE
# VSCode: Cmd+Shift+P > "TypeScript: Restart TS Server"
# WebStorm/IntelliJ: File > Invalidate Caches

# Или просто перезапустите dev server
npm run clean && npm run web
```

### Изображения не загружаются

**Проверьте:**
1. Файл существует: `/assets/images/pdf.webp`
2. Размер файла < 500KB
3. Формат поддерживается (webp, jpg, png)

---

## 📱 Тестирование на устройствах

### iOS (Safari)
```bash
# Запустите на локальной сети
npm run web

# Откройте на iPhone:
# http://[ваш-ip]:8081

# Проверьте:
- Плавность скролла
- Touch таргеты кнопок (56px)
- Анимации (60fps)
```

### Android (Chrome)
```bash
# Те же шаги
npm run web

# Откройте на Android:
# http://[ваш-ip]:8081

# Дополнительно проверьте:
- removeClippedSubviews работает
- Нет memory leaks
- Плавный скролл FlatList
```

---

## 📈 Мониторинг метрик

### Web Vitals
Добавьте в `app/_layout.tsx`:

```typescript
import { useEffect } from 'react';

export default function RootLayout() {
  useEffect(() => {
    if (typeof window !== 'undefined' && 'performance' in window) {
      // LCP
      new PerformanceObserver((list) => {
        const entries = list.getEntries();
        const lastEntry = entries[entries.length - 1];
        console.log('LCP:', lastEntry.renderTime || lastEntry.loadTime);
      }).observe({ entryTypes: ['largest-contentful-paint'] });

      // FID
      new PerformanceObserver((list) => {
        list.getEntries().forEach((entry) => {
          console.log('FID:', entry.processingStart - entry.startTime);
        });
      }).observe({ entryTypes: ['first-input'] });

      // CLS
      let clsScore = 0;
      new PerformanceObserver((list) => {
        list.getEntries().forEach((entry: any) => {
          if (!entry.hadRecentInput) {
            clsScore += entry.value;
            console.log('CLS:', clsScore);
          }
        });
      }).observe({ entryTypes: ['layout-shift'] });
    }
  }, []);

  return (
    // ...ваш layout
  );
}
```

---

## 🎯 Контрольные точки (1 неделя)

### День 1 (сегодня)
- [x] Оптимизация выполнена
- [ ] Очистка кеша
- [ ] Запуск приложения
- [ ] Визуальная проверка

### День 2
- [ ] Lighthouse audit
- [ ] Bundle size analysis  
- [ ] Тестирование на iPhone
- [ ] Тестирование на Android

### День 3
- [ ] Сбор метрик Web Vitals
- [ ] Сравнение с baseline
- [ ] Документирование результатов

### День 4-5
- [ ] Fix проблем (если есть)
- [ ] Финальное тестирование
- [ ] Deploy в production

---

## 📚 Дополнительные ресурсы

### Документация
- `HOME_PAGE_OPTIMIZATION_REPORT.md` - полный отчёт
- `HOME_PAGE_OPTIMIZATION_SUMMARY.md` - краткое резюме
- `PHASE4_QUICK_START.md` - Phase 4 план
- `READY_TO_USE_GUIDE.md` - общая интеграция

### Полезные команды
```bash
# Проверка типов
npx tsc --noEmit

# Линтинг
npm run lint

# Тесты
npm run test:run

# E2E тесты
npm run e2e
```

---

## ✅ Чек-лист готовности

Перед deploy в production:
- [ ] Lighthouse score > 90
- [ ] Все тесты проходят
- [ ] Нет ошибок TypeScript
- [ ] Нет предупреждений ESLint
- [ ] Тестирование на iOS
- [ ] Тестирование на Android
- [ ] Тестирование на медленном 3G
- [ ] Bundle size < 500KB (gzipped)
- [ ] LCP < 2.5s
- [ ] FID < 100ms
- [ ] CLS < 0.1

---

**Вопросы?** Смотрите документацию выше или создайте issue в репозитории.

**Удачи!** 🚀

