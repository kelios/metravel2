# Оптимизация Core Web Vitals

Этот документ описывает реализованные оптимизации для улучшения Core Web Vitals.

## Реализованные оптимизации

### 1. LCP (Largest Contentful Paint) - Оптимизация

✅ **Предзагрузка ключевых ресурсов:**
- Добавлен `preload` для LCP изображения (`/images/hero.avif`)
- Предзагрузка критичных шрифтов (`roboto-var.woff2`)
- DNS prefetch и preconnect для внешних ресурсов (S3, аналитика)

✅ **Оптимизация изображений:**
- Использование `fetchpriority="high"` для LCP изображений
- Компонент `OptimizedImage` с поддержкой WebP/AVIF
- Фиксированные размеры для предотвращения CLS

### 2. CLS (Cumulative Layout Shift) - Минимизация

✅ **Фиксированные размеры:**
- Все изображения имеют атрибуты `width` и `height`
- CSS `aspect-ratio` для сохранения пропорций
- Placeholder'ы с фиксированными размерами

✅ **CSS оптимизации:**
- `content-visibility: auto` для изображений
- `contain: layout style paint` для LCP элементов

### 3. INP/FID (Interaction to Next Paint / First Input Delay) - Снижение

✅ **Отложенная загрузка:**
- Аналитика загружается через `requestIdleCallback` (после 2 секунд)
- Lazy loading для Footer компонента
- Отложенная загрузка некритичных скриптов

✅ **Оптимизация JavaScript:**
- Code splitting через React.lazy()
- Минификация в production режиме
- Оптимизация импортов пакетов

### 4. Оптимизация загрузки ресурсов

✅ **Code Splitting:**
- Footer загружается лениво
- Критичный CSS инлайнится в `<head>`

✅ **Кеширование:**
- Настроено кеширование через `.htaccess`
- Длительное кеширование для статических ресурсов (1 год)
- Среднее кеширование для CSS/JS (1 месяц)

### 5. Оптимизация изображений

✅ **Современные форматы:**
- Поддержка WebP/AVIF через `.htaccess` rewrite rules
- Автоматическое определение поддержки браузером
- Fallback на оригинальные форматы

✅ **Lazy Loading:**
- Все изображения в списках используют `loading="lazy"`
- `decoding="async"` для неблокирующей декодировки

### 6. Кеширование и CDN

✅ **Настроено в `.htaccess`:**
- Длительное кеширование для изображений (1 год)
- Кеширование шрифтов (1 год)
- Кеширование CSS/JS (1 месяц)
- Сжатие через mod_deflate

✅ **Рекомендации:**
- Использовать CDN для статических ресурсов
- Настроить CloudFront/S3 для изображений

### 7. Оптимизация сторонних скриптов

✅ **Аналитика:**
- Yandex Metrika и Google Analytics загружаются отложенно
- Используется `requestIdleCallback` для неблокирующей загрузки
- `defer` и `async` атрибуты

✅ **Внешние виджеты:**
- Рекомендуется отложить загрузку виджетов бронирования
- Использовать `loadScriptDeferred` из `utils/performance.ts`

## Использование

### OptimizedImage компонент

```tsx
import { OptimizedImage } from '@/components/OptimizedImage'

<OptimizedImage
  src="/images/hero.jpg"
  alt="Hero image"
  width={1200}
  height={600}
  priority="high"
  loading="eager"
  aspectRatio={2}
/>
```

### Утилиты производительности

```tsx
import { 
  loadScriptDeferred, 
  preloadResource,
  deferExecution 
} from '@/utils/performance'

// Отложенная загрузка скрипта
loadScriptDeferred('https://example.com/widget.js', 'widget-script')

// Preload ресурса
preloadResource('/images/hero.avif', 'image', 'image/avif')

// Отложенное выполнение
deferExecution(() => {
  // Инициализация некритичного функционала
}, 2000)
```

## Мониторинг

### Lighthouse

Запустите Lighthouse аудит:
```bash
npm run build:web
# Затем откройте в браузере и запустите Lighthouse
```

### Real User Monitoring (RUM)

Рекомендуется настроить мониторинг через:
- Google Analytics 4 (уже настроен)
- Yandex Metrika (уже настроен)
- Web Vitals библиотека для детального мониторинга

### GitHub Actions

Можно настроить автоматический аудит через GitHub Actions:

```yaml
name: Lighthouse CI
on: [push]
jobs:
  lighthouse:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: treosh/lighthouse-ci-action@v9
        with:
          urls: |
            https://metravel.by
          uploadArtifacts: true
```

## Дополнительные рекомендации

1. **CDN:** Настройте CloudFront или другой CDN для статических ресурсов
2. **Изображения:** Конвертируйте все изображения в WebP/AVIF
3. **Шрифты:** Используйте `font-display: swap` (уже настроено)
4. **Service Worker:** Рассмотрите добавление Service Worker для офлайн-кеширования
5. **HTTP/2 Server Push:** Настройте push для критичных ресурсов

## Метрики для отслеживания

- **LCP:** < 2.5s (хорошо), < 4.0s (нужно улучшить)
- **CLS:** < 0.1 (хорошо), < 0.25 (нужно улучшить)
- **INP:** < 200ms (хорошо), < 500ms (нужно улучшить)
- **FCP:** < 1.8s (хорошо), < 3.0s (нужно улучшить)

## Чеклист перед деплоем

- [ ] Проверить все изображения имеют width/height
- [ ] Убедиться что LCP изображение предзагружено
- [ ] Проверить что аналитика загружается отложенно
- [ ] Запустить Lighthouse аудит
- [ ] Проверить кеширование через DevTools
- [ ] Протестировать на медленном соединении (3G)

