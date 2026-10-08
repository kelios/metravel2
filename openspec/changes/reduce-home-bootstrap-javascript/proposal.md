## Why

Мобильный PageSpeed главной показывает 49 баллов, LCP 8,1 с и TBT 700 мс. Свежая проверка production подтверждает лишнюю работу JavaScript, но показывает различие моделей Lighthouse: simulate — 50 баллов/LCP 9,57 с/TBT 408 мс; applied — 79 баллов/LCP 2,19 с/TBT 748 мс. Исправление должно уменьшать реальную работу приложения, сохраняя ранний статический экран.

## What Changes

- Устранить ранний импорт нижней формы подписки через существующий `homeDeferredSections.web.tsx`; native сохраняет обычный импорт. Триггер видимости и резерв места не меняются.
- На production-графе проверить зависимость формы от монолитного `api/misc.ts`. Только если этот путь удерживает лишние модули, выделить транспорт подписки с совместимым экспортом из `misc`.
- Перед остальными оптимизациями получить компонентную атрибуцию длинной задачи bootstrap (382 мс в текущем applied trace). Не менять общий startup по предположению.
- Сопоставить до/после граф импортов, весь сетевой журнал и оба режима Lighthouse; фиксировать остаточный TBT отдельно от улучшения конкретной зависимости.

## Capabilities

### New Capabilities

- `home-bootstrap-performance`: загрузка кода нижних секций главной по существующей видимости и проверка результата на реальном production.

### Modified Capabilities

Нет существующих OpenSpec capabilities с изменяемыми требованиями.

## Impact

- Task-owned paths: `components/home/Home.tsx`, `components/home/homeDeferredSections.web.tsx`, `components/home/homeDeferredSections.tsx`, профильные тесты; условно `api/misc.ts` и отдельный модуль транспорта подписки после доказательства графом. План и evidence — эта папка OpenSpec. `scripts/ssg-skeletons.js` и общий root chrome не входят в выбранное исправление.
- Platform impact: desktop web | mobile web; native adapter проверяется code-level, Android/iOS runtime не меняется.
- Localization impact: none — RU/BE/UK/PL/EN сохраняют текущие строки и форматирование.
- User-visible impact: прежняя форма появляется при прежнем условии видимости; первый экран и интерактивность не ухудшаются. SEO, accessibility, analytics: сохранить DOM/метаданные, согласие, подписи и события; новых сущностей нет.
- Data/API, security: прежние запросы подписки и обязательное согласие без изменений, backend read-only. Изоляция транспорта не разрешает изменение его контракта.
- Dependencies: историческая семья APP-SHELL-BOOT (#1643), статический LCP (#1281/#1358); обязательная координация quality lock. Нет новых пакетов.
- Fallback/mock policy: существующие placeholders и обработка ошибок остаются; runtime evidence только с реальными renderer/transport, без моков и warmed-cache обходов.
- Non-goals: редизайн hero, изменение фотографии/её contain-геометрии, таймер задержки всего приложения, снятие route hydration gates, service-worker caching, перенос eager weekend feed или high-priority quests на interaction, изменение budget ceilings, изменения backend/store.
- Planning boundary: артефакты не разрешают apply; реализация начинается отдельным запросом после представления плана.
