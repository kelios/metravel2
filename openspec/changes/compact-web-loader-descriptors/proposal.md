## Why

Связанная задача #3451 нужна для выпуска #3449: два канонических кандидата не проходят точный entry-предел при неизменной логике entry. В каждом частном дескрипторе повторяется версия, уже проверяемая общим реестром. Сокращение должно уменьшить настоящую доставку, не менять предел или основу замера.

## What Changes

- Эмиттер выпускает `[mapId]`; декодер также читает прежний `['mc1', mapId]`.
- Реестр mc1, отдельные карты вызывающих модулей, замыкания, хеширование, worker-пути и completion сохраняются.
- Дополняются существующие реальные Metro/Expo fixtures и отрицательные проверки.
- Пределы, алгоритм разбиения чанков, upstream, экраны, backend и продуктовый API вне изменения.

## Capabilities

### New Capabilities

Нет.

### Modified Capabilities

- `web-startup-payload-budget`: короткий совместимый служебный дескриптор при полном учёте байтов.

## Impact

Task type: внутренний web-codec, #3451, совместный выпуск с #3449. Task-owned paths: scripts/lib/webChunkMetadataCodec.js, scripts/lib/webChunkMetadataRuntime.js, существующие профильные тесты, документация и этот OpenSpec.
Platform impact: desktop web | mobile web; Android/iOS не затронуты.
Localization impact: none — UI-строк и locale-правил нет.
User-visible impact: меньшая фактическая доставка JS при прежних экранах. API/data: только частное описание загрузки; сетевой API без изменений. SEO/accessibility: без изменений. Security: все fail-closed проверки и границы prefix сохраняются.
Dependencies: жёстких нет, related #2738/#3374/#3449. Fallback/mock policy: fixtures только для source tests, итог по настоящему каноническому артефакту и опубликованным страницам.
Evidence: побайтное воспроизведение установленным Metro/Terser; 140 дескрипторов, 252 артефакта, 18 отрицательных вариантов. Полный entry с совместимым декодером: 232708 → 232602 Б в исходной пробе, не итоговая публикация.
Validation: targeted Jest codec/runtime/resolver/closure, scoped ESLint, strict OpenSpec, независимый review/gate; нормальный выкат с прежними пределами и одна мобильная веб-проверка загрузки/планировщика. Неприменимые одинаковые desktop/native прогоны не добавляются.
