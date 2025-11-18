# Performance Deployment Checklist

## CDN и статика
- **Экспортируй веб-сборку**: `EXPO_PUBLIC_API_URL=https://api.metravel.by yarn expo export --web`.
- **Загрузи `/dist` на CDN** (Cloudflare Pages, Netlify или любой edge-бекенд) с включённым Brotli и HTTP/3.
- **Правила кеширования**:
  - `/_expo/static/**` и `/assets/**`: `Cache-Control: public, max-age=31536000, immutable`.
  - HTML и JSON манифесты: `Cache-Control: public, max-age=0, must-revalidate`.
- **Безопасность**: добавь `Strict-Transport-Security` и `Content-Security-Policy default-src 'self' https://cdn.jsdelivr.net`.

## Lighthouse CI
- Установи `lighthouse-ci` и добавь `lighthouserc.json`:
  ```json
  {
    "ci": {
      "collect": {
        "url": ["https://metravel.by/", "https://metravel.by/map"],
        "numberOfRuns": 3,
        "settings": {
          "preset": "mobile",
          "throttlingMethod": "simulate"
        }
      },
      "assert": {
        "assertions": {
          "categories:performance": ["error", { "minScore": 0.9 }],
          "first-contentful-paint": ["warn", { "maxNumericValue": 2500 }],
          "largest-contentful-paint": ["warn", { "maxNumericValue": 3000 }],
          "total-blocking-time": ["warn", { "maxNumericValue": 200 }],
          "cumulative-layout-shift": ["warn", { "maxNumericValue": 0.1 }]
        }
      }
    }
  }
  ```
- Добавь GitHub Action:
  ```yaml
  - uses: treosh/lighthouse-ci-action@v11
    with:
      urls: |
        https://metravel.by/
        https://metravel.by/map
      temporaryPublicStorage: true
  ```
- Отсматривай отчёты в PR и фиксируй регрессии до слияния.

