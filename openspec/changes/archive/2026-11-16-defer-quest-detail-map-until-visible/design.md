## Context

Мотивация и цели — в proposal.md. Исходный source chain до исправления: `questWizardSections.tsx:156` монтирует карту при `routeMode`; `QuestFullMapLazy.tsx:3` только делит bundle; `QuestFullMap.tsx:217` при mount загружает Leaflet, затем MapCanvas запрашивает тайлы. Старый `QuestMapSkeleton` резервирует 300 px при фактических 360/460/520 px. Отдельный `QuestFullMapLazy.native.tsx` прямо экспортирует native-карту.

`TravelsForQuestSection` использует `UnifiedTravelCard`: media по умолчанию lazy, номинальные 320 CSS px проходят DPR cap2 и дают w640. На DPR3 это не доказательство oversized; свежий DOM baseline подтвердил356CSS/DPR3/w640 mobile и249.75CSS/DPR1/w320 desktop: resizing не обоснован. API-состав и hooks не меняются.

## Goals / Non-Goals

**Goals:** убрать mount тяжёлого web renderer вне viewport, сохранить геометрию, реальный размер обложек и карта-действия. Проверить page-wide transfer и scroll CLS.

**Non-Goals:** новые shared media helpers, изменение visibility hook, размеры изображений без DOM evidence, native карта/WebView, route/API/auth/analytics/SEO changes, чужие task paths и budgets.

## Decisions

1. Повторно использовать `useProgressiveLoad` с `disableFallbackOnWeb:true`, `threshold:0`, коротким proximity-margin. Hook уже покрывает одноразовое включение и отсутствие IntersectionObserver. Единственный visibility site находится в named `QuestMapVisibilityGate` существующего async-entry `QuestFullMap`; wrapper импортирует один literal target для gate и renderer, gate принимает только ref/enabled/onActivate и сам карту не монтирует. Новый observer или fallback timer отклонены: дублируют механизм или снова грузят невидимую карту.
2. `QuestWizard` передаёт явный opt-in только для web mobile intro через `QuestDesktopMapPanel`. `QuestFullMapLazy.tsx` фиксирует initial mode через state initializer. Initially default всегда возвращает original lazy renderer напрямую: без новой рамки, observer и внутреннего Suspense, с прежним внешним cold fallback300 даже при later mobile. Initially opt-in всегда остаётся в `DeferredMapSession` с одной рамкой/Suspense ancestry; hook enabled только до первой активации. Activation latch запоминает visibility либо выход из opt-in: обратная смена viewport/шага renderer не размонтирует. Только opt-in рамка резервирует `height` (default520) до и во время import; внутренний Suspense не отдаёт outer fallback геометрию300. Native re-export остаётся прежним. В `questWizardSections.tsx` только opt-in placeholder до `routeMode` получает ту же вычисленную высоту; внешний Suspense всегда сохраняет original300px skeleton. Opt-in import ловит собственный внутренний Suspense с точной высотой, default/native fallback остаётся300px. Native файл не меняется.
3. Новый deferral регистрируется в `docs/RULES.md` и зеркале `scripts/guard-web-deferred-loading.js` после полученного root/user boundary confirmation как реализация прямого требования #3440: один named wrapper и один вызов hook, без других исключений. Guard сохраняет запрет остальных незаявленных мест.
4. Covers меняем только по свежим source+DOM фактам. Уже-correct lazy/w640 не переписываем ради числа из исторического аудита. Коммитим реальную e2e-проверку lazy/media geometry как regression control без ослабления budget.

## Risks / Trade-offs

- [Поздний mount на медленной сети] → небольшое приближение к viewport и стабильный placeholder; tiles доступны после завершения загрузки без скрытия контента.
- [Outer Suspense возвращает300px] → внутренний Suspense и fallback с точной высотой; unit на 360/460/520 и async import.
- [Видимый desktop map] → eager на первом render без observer; desktop real-data transfer/visibility контроль. Mobile→desktop до visibility активирует eager сразу.
- [Смена ветки wrapper размонтирует renderer и теряет fullscreen/export] → latched initial mode, постоянная opt-in ancestry + monotonic activation latch; real stateful RNW rerender regression покрывает mobile→desktop→mobile, смену шага и initially eager→mobile.
- [Chromium предзагружает lazy covers далеко ниже viewport] → отличаем lazy request от eager, измеряем атрибут и реальный слот/DPR; не объявляем prefetch дефектом автоматически.
- [Регрессия family guard] → registry/allowlist согласованы, unchanged helper тесты переиспользуются, target guard выполняется в выделенное окно.

## Validation matrix

- До apply: нормальный production baseline delivery live4c1de3a60, guestRU/cold/noScroll/3squiet: mobile1735608CLB→1695KiB, desktop1524408CLB→1489KiB,74reqeach,CLS0/0; routingPOST200ORSoptimaltrue, GET-fallbackнет. Tiles241813CLB; Leaflet3modules50109CLB. CDPwire1909625/1698186B хранится отдельно. На этапе baseline это были2из8normal views; полный actual ledger и последующие completion views описаны ниже.
- Code-only: targeted Jest web-wrapper (реальный hook с DOM observer либо ближайший существующий hook test плюс wrapper integration), skeleton height, legacy map/editorial/nearby controls; targeted lint/type source checks; guard:web-deferred-loading; OpenSpec strict validation. Heavy/static запускаются только в выданное окно.
- Live e2e блокирует все write-methods кроме same-origin POST `/api/routing/route/` без query с точным frozen quest4 payload:8пар lat/lng, `transport_mode:foot`, без дополнительных полей. Набор скопирован из разрешённого normal baseline; смена контента инвалидирует gate до новой baseline. Negative controls отвергают иной endpoint/origin/mode/координаты/поля/method/query. Console.error/pageerror/requestfailed/HTTP4xx5xx всегда fail; каждый видимый tile должен complete+naturalWidth>0, low transfer без healthy map не принимается.
- Независимые review-auditor → code-review-gate читают полный task diff. Runtime/browser в review не запускаются.
- После review+commit+push+testing и штатного deploy: реальная страница два cold guest RU прогона mobile390DPR3 и desktop1440, ready≤1600/1489КБ, eagerbelowfold0, scroll/map/nearby visible, CLS≤0,1; console/4xx/5xx/duplicate URL variants и CSS-slot/DPR. Mock не доказывает performance.
- Android/iOS runtime omitted: separate native re-export/renderer неизменны; source assertion на split. Localization none: ресурсы/форматы не меняются.

## Migration Plan

Нет data migration. Изменение выкатывается штатным source release после review и push; delivery проверяет `.build-source.json` и тот же frozen SHA. Откат — revert task commit и штатный redeploy, без API/данных. SEO, accessibility semantics, security и analytics прежние, поскольку меняется только mount существующей карты.

## Audit repair — 16.11.2026

Независимый auditor подтвердил2P2: смена ancestry при responsive flag сбрасывала map state; e2e мог принять частичную сетевую поломку как снижение веса. Исправлены только эти причины; прежний16path manifest45cb6d7/patch8c67c445 сохранён в ignored history. После выделенного lease affected checks и повторные independent auditor/gate PASS, findings0; immutable evidence сохранено.

Повторный audit выявил отдельный P2 cold default geometry: общая рамка/internalSuspense меняла default300 fallback на actual map height. Решение уточнено до initial-session latch: default остаётся прямым renderer, только initially opt-in держит контейнер. Отдельный реальный React cold-suspension DOM test проверяет внешний300px skeleton и отсутствие внутренней рамки/placeholder; stateful rotation/current-step tests сохраняются. Snapshot544eefc/f3e0fd48 сохранён рядом с45cb6d7/8c67c445; это historical precheck snapshot, последующие source48compatible/TS/lint/guard/checkfast PASS и независимые approvals записаны в tasks.md.


## Recorded release and acceptance

Canonical93e опубликован под неизменёнными entry/eager/request budgets, все121HTML/
86aliases PASS; API3442 a774 включён без изменения тела formatter. Four normal
metric cases дают desktop1465KiB (75requests vsbaseline74), mobile1386KiB (64);
noScroll3squiet positiveCLround formula прежняя, wire отдельно. Real routing
POST200/ORS8foot/optimal152pts2539m; source pin93e до/после каждого случая.
Mobile below-fold dependencies0; visible desktop eager законен.

Slot7 failed predicate сохранён: он проверял невидимую часть raw420Leaflet вне
унаследованного360overflow clip. Root independently viewed PNG/source: не новая
регрессия. Slot8 correct visible intersection340×261 дал9/9map hits, decoded
realtiles/readable route/markers и4nearby covers lazy/w640/client356≤720,
natural scroll/decode/nonocclusion, stable360/CLS0/strict errors0. Это completion
missing functional evidence, не retry performance FAIL и не замена4metric cases.
Full420 и fully-unclipped8markers не заявлены. Ledger8/8 — больше Quest views нет.

Native SEO sitemap timeout остаётся nonblocking warning; full e2eTS6legacy
errors NOT PASS. Source/acceptance/API/runtime/Map code не меняется при этом
closure. Board3440/3442 testing до normal docs publication и root closure check;
никакого нового deploy/GET/browser для docs receipt не требуется.
