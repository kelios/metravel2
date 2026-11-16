## Why

На живой странице `/quests/4/minsk-kids-bronze-friends` аудит #3390 измерил 1695–1697 КБ до прокрутки при mobile-потолке 1600 КБ: карта ниже экрана немедленно запрашивала шесть тайлов. Карточка #3440 требует сохранить качество и доступность карты и обложек, уменьшив невидимую загрузку; нормальная baseline-проба live `4c1de3a60` от16.11.2026 подтвердила1695/1489KiB, CLS0/0, ORS POST200 без GET-fallback до product edits.

## What Changes

- Только web mobile intro явно включает ожидание карты до приближения к viewport без таймера, сохраняя точную высоту слота. Initially default и desktop сохраняют прямой eager renderer и прежний внешний cold fallback300 без новой рамки/observer/внутреннего fallback. Initial mode фиксируется на lifetime mount; initially default не превращается в opt-in при rotation.
- Сохраняются native eager renderer, desktop-карта в видимой области, toolbar/fullscreen/export и API/data-контракт. После активации карта сохраняет state и ancestry при rotation/смене шага; до активации выход из opt-in включает eager немедленно.
- Обложки соседних материалов проверяются по реальному lazy-атрибуту, CSS-слоту и DPR; размер меняется только при подтверждённом несоответствии, без снижения качества.
- Коммитится регрессия: до прокрутки вне экрана нет eager-изображений/тайлов; карта появляется при прокрутке без сдвига слота. Сетевой сбой, HTTP4xx/5xx, console.error/pageerror или недекодированный видимый тайл не дают ложного прохождения transfer budget. Read-only boundary допускает только точный ранее согласованный public quest4 routing compute POST.
- Цель live ready: mobile390 DPR3 ≤1600 КБ; desktop1440 ≤1489 КБ; CLS при прокрутке ≤0,1; бюджеты не повышаются.

## Capabilities

### New Capabilities

- `quest-detail-deferred-map`: загрузка невидимой карты детали квеста при приближении пользователя, стабильная геометрия и доступность после прокрутки.

### Modified Capabilities

Нет: существующие спецификации каталога и прохождения не меняются.

## Impact

- User-visible result: меньше передачи до прокрутки, та же карта и изображения после неё.
- Platform impact: mobile web и desktop web. Android/iOS сохраняют отдельный eager renderer; source inspection подтверждает split, device QA не нужен для неизменённого native-кода.
- Localization impact: none; RU/BE/UK/PL/EN resources и редакционный контент не меняются.
- Paths: `components/quests/QuestFullMapLazy.tsx`, явный флаг из `QuestWizard.tsx` и геометрия opt-in fallback в `questWizardSections.tsx`, quest-тесты, отдельный quest e2e, профильный feature doc. Единственная запись реестра `docs/RULES.md` и зеркало guard разрешены root/user как прямое требование TaskContract #3440; дополнительных исключений нет.
- Dependencies: hard board dependencies отсутствуют; baseline получен и source lease выдан в отдельной detached worktree от `afe3c6cec`; исторические leases завершены: source F8 опубликован в canonical93e и прошёл live acceptance; текущий docs-only closure commit/push ждёт root slot после3434.
- Fallback/mock policy: unit-моки допустимы для visibility/геометрии; performance принимается только на реальных данных после штатного выката, два прогона каждого viewport. Без IntersectionObserver карта доступна сразу.
- API/data: endpoints, payloads и состав соседних материалов прежние; меняется только момент media request.
- SEO: URL, canonical, metadata, structured data и редакционный SSR-контент прежние. Accessibility: карта сохраняет title, toolbar и keyboard actions; placeholder не интерактивен.
- Security/analytics: входы, URL, secrets, WebView bridge и события не меняются.
- Non-goals: backend/API, partner iframe, содержание «рядом», общие media helpers, travel #3436, hooks/profile #3441, budget helper, native renderer, контейнеры и локальный стек.
- Open questions: none. Четыре nearby covers и AI-подборки уже lazy; mobile356CSS/DPR3/w640 и desktop249.75CSS/DPR1/w320 не требуют source edits. Live acceptance на93e теперь доказан фактическими4metric PASS и отдельным mobile functional completion; точные caveats/provenance — tasks.md.
