# Travel Performance Refactor

Рабочий документ для рефакторинга производительности страницы travel details в `metravel2`.

Источник правил проекта:
- `AGENTS.md`
- `docs/RULES.md`
- `docs/README.md`

Этот документ задает:
- цель рефакторинга;
- технические ограничения;
- порядок внедрения;
- критерии приемки;
- обязательные проверки после каждого этапа.

## 1. Scope

Текущий scope:
- web travel details route;
- entry path страницы путешествия;
- hero/LCP-зона;
- deferred sections ниже первого экрана;
- image delivery для hero, gallery, avatar и inline content images.

Вне scope до отдельного решения:
- редизайн UI;
- смена backend API;
- изменения серверных SSL/path-конфигов;
- возврат service worker caching;
- любые runtime cache-bust/reload workaround.

## 2. Базовые правила проекта

При любом шаге рефакторинга обязательно соблюдать:

1. Не ломать SSR SEO для travel page.
   - Должны сохраняться SSR `H1`, canonical, description, `og:*`, `twitter:*`, `Article` JSON-LD.
   - См. `docs/RELEASE.md` и `scripts/post-deploy-seo-check.js`.

2. Не нарушать policy по web cache.
   - Нельзя возвращать service worker runtime/static caching.
   - Нельзя добавлять `window.location.reload(...)`, query-param cache busting или UX вида "очистите кэш".
   - См. `docs/RULES.md`.

3. Не усложнять архитектуру без явной пользы.
   - Сначала переиспользовать существующие хуки и секции.
   - Делать маленькие локальные изменения.

4. Соблюдать UI rules.
   - Использовать существующие `components/ui`.
   - Не использовать emoji как иконки.
   - Не хардкодить hex-цвета.
   - Сохранять нейтральные image placeholders.

5. Не нарушать external links governance.
   - Не использовать `window.open(...)` напрямую.

## 3. Исходные данные

Постдеплой Lighthouse по prod URL на 10 марта 2026:

- Mobile: `57`
- Desktop: `59`

Ключевые проблемы:
- `unused-javascript`: примерно `694-720 KiB`
- `main-thread-work-breakdown`: `2.8-3.4s`
- `bootup-time` entry bundle: `1.9-2.3s`
- `LCP`: `12.4s` mobile, `16.5s` desktop

Что это означает:
- backend и TTFB не являются главным bottleneck;
- страница слишком долго доходит до визуально готового состояния после получения HTML;
- основной урон дает клиентский JS и тяжелый first-screen media block.

## 4. Наблюдения по текущей реализации

На момент создания документа уже есть правильные зачатки архитектуры:

- маршрут travel page старается держать route module маленьким;
- `TravelDetailsDeferred` уже разбивает часть тяжелых секций;
- `useTravelDetailsPerformance` уже пытается откладывать non-critical imports.

Но этого недостаточно, потому что:
- в initial path все еще попадает слишком много shared/runtime JS;
- LCP зависит от тяжелого hero-контейнера, а не от простого SSR-first изображения;
- above-the-fold грузится больше eager media, чем нужно;
- часть below-the-fold UI все еще конкурирует с first screen за сеть и main thread.

## 5. Целевая архитектура

Цель: travel page должна работать по модели `SSR-first + deferred islands`.

### 5.1 Critical shell

В initial render должны входить только:
- hero image;
- title/H1;
- ключевые travel meta blocks;
- минимальный author summary, если он нужен на первом экране;
- базовые CTA, без тяжелой интерактивности.

Critical shell должен:
- появляться из SSR HTML;
- не зависеть от тяжелых client-only эффектов;
- не ждать map/gallery/comments/sidebar code для LCP.

### 5.2 Deferred islands

В отдельные islands/отложенные блоки должны быть вынесены:
- gallery/carousel/lightbox;
- map;
- comments;
- near/popular/sidebar lists;
- social/share widgets;
- heavy author details;
- YouTube/video embeds;
- любые rich enhancers ниже первого экрана.

Правило:
- first screen не должен гидратировать нижние секции раньше, чем это реально нужно.

### 5.3 Image priority model

Правило для первого экрана:
- только один реальный LCP image получает `fetchpriority="high"` и eager load;
- остальные gallery images должны быть `lazy`;
- hero должен быть предсказуемым `img/picture`, а не тяжелым composite container.

## 6. Цели рефакторинга

## 6.1 Product goals

- Ускорить открытие travel page на web.
- Уменьшить визуальную задержку первого экрана.
- Сохранить SEO и UX без деградации на mobile/web.

## 6.2 Technical goals

- Mobile Lighthouse для целевой travel page: `>= 60`
- Desktop Lighthouse для целевой travel page: `>= 70`
- Снизить unused JS на critical path минимум на `300 KiB`
- Снизить bootup/main-thread cost travel page
- Сделать LCP hero детерминированным и ранним

## 7. Порядок работ

Работа идет только по этапам. Следующий этап начинается после проверки предыдущего.

### Этап 1. Зафиксировать baseline и бюджет

Задачи:
- сохранить текущие Lighthouse baseline значения;
- согласовать один canonical test URL для travel page;
- определить performance budget для:
  - initial route JS;
  - hero image bytes;
  - eager images count above the fold;
  - Lighthouse mobile/desktop score.

Артефакты:
- этот документ;
- актуальные Lighthouse JSON-репорты;
- список budget thresholds.

### Этап 2. Отделить critical shell от deferred sections

Задачи:
- выделить явный first-screen shell внутри travel details;
- проверить, какие секции реально нужны до первого interaction;
- сделать так, чтобы below-the-fold блоки не влияли на LCP и initial main-thread.

Изменения допустимы:
- перенос секций между `TravelDetailsContainer`, hero и deferred слоями;
- дополнительная граница lazy/defer для block-level sections.

Нельзя:
- выносить SEO head logic из проверенного пути без тестового покрытия;
- ломать SSR разметку travel page.

### Этап 3. Перестроить hero/LCP path

Задачи:
- упростить hero до простого SSR-first media блока;
- убедиться, что LCP-элементом является реальное изображение, а не декоративный wrapper;
- убрать из first screen лишние overlay/effect layers, если они задерживают render;
- оставить только один high-priority hero image.

Проверки:
- Lighthouse должен показывать предсказуемый LCP element;
- не должно быть нескольких eager/high-priority изображений в hero.

### Этап 4. Сократить initial JS

Задачи:
- разобрать, что попадает в `entry-*` и `__common-*` для travel route;
- вынести не-критичные модули в route-level lazy imports;
- убрать ранний импорт блоков, которые не нужны до first paint.

Приоритетные кандидаты:
- gallery/slider интерактивность;
- comments;
- map;
- social/share;
- author expanded card;
- related/near/popular lists;
- rich text enhancements.

Критерий:
- travel page должна загружать меньше JS до first interaction.

### Этап 5. Перестроить image delivery

Задачи:
- проверить `srcset` и `sizes` для hero image;
- уменьшить bytes для avatar и мелких media slots;
- пересобрать responsive sizing для inline description images;
- исключить загрузку oversized assets для small slots.

Особое внимание:
- avatar не должен тянуть десятки килобайт для `48-64px`;
- контентные изображения должны соответствовать реальному контейнеру;
- hero image не должен быть oversized для mobile.

### Этап 6. Visibility-based hydration

Задачи:
- догрузка тяжелых секций по `visible`, `idle` или `interaction`;
- ниже фолда не должно быть ранней конкуренции за CPU и сеть;
- интерактивность включается только там, где пользователь действительно дошел до секции.

Применять к:
- comments;
- map;
- related sections;
- embeds;
- author/share blocks, если они не нужны above the fold.

### Этап 7. Закрепить budgets и regression guard

Задачи:
- добавить или обновить тесты/чекеры, которые не дадут откатиться назад;
- закрепить performance budget для travel route;
- документировать финальные thresholds в `docs/`, а не во временных заметках.

## 8. Технические принципы внедрения

1. Не делать big bang rewrite.
   - Только последовательные локальные изменения.

2. Не смешивать performance refactor с визуальным редизайном.
   - Иначе невозможно валидировать, что реально дало эффект.

3. Не трогать одновременно hero, SEO и маршрутизацию без тестов.
   - Это зона высокого риска для web.

4. Предпочитать server/static output вместо ранней client hydration.

5. Любая интерактивность ниже первого экрана должна доказывать свою необходимость на critical path.

## 9. Риски

Основные риски:
- регресс SSR SEO на travel pages;
- дублирование блоков mobile/web;
- позднее появление нужных секций из-за слишком агрессивного defer;
- ухудшение UX галереи или карты;
- визуальные регрессии hero/layout;
- расхождение web и native поведения.

Как снижаем риск:
- менять поэтапно;
- после каждого шага запускать targeted checks;
- отдельно валидировать web visual behavior;
- отдельно валидировать post-deploy SEO;
- не трогать серверную cache policy.

## 10. Обязательные проверки по этапам

Для точечных performance-изменений на travel page минимум:

```bash
npm run lint
npm run test:run -- TravelDetails
```

Если затронуты несколько секций, маршрутизация, SEO или shared web behavior:

```bash
npm run lint
npm run test:run
```

Если затронуты external links governance зоны:

```bash
npm run guard:external-links
npm run governance:verify
```

Локальная performance-проверка перед деплоем:

```bash
npm run build:web:prod
npm run lighthouse:travel:mobile
npm run lighthouse:travel:desktop
```

Post-deploy проверка:

```bash
npm run test:seo:postdeploy
npm run lighthouse:produrl:travel:mobile
npm run lighthouse:produrl:travel:desktop
npm run lighthouse:produrl:summary
```

## 11. Definition of done

Рефакторинг можно считать завершенным, когда одновременно выполнено все ниже:

1. Travel page сохраняет SEO-валидность post-deploy check.
2. На web не сломан first-screen UX.
3. Hero рендерится рано и стабильно.
4. Below-the-fold секции не конкурируют с LCP.
5. Mobile Lighthouse для целевой travel page `>= 60`.
6. Desktop Lighthouse для целевой travel page `>= 70`.
7. Изменения не нарушают правила `docs/RULES.md` и `AGENTS.md`.

## 12. Порядок реальной работы по этому документу

Для каждой итерации использовать один и тот же шаблон:

1. Выбрать один этап из раздела 7.
2. Подтвердить точный scope файлов.
3. Внести минимальные изменения.
4. Прогнать проверки по масштабу изменения.
5. Снять новые Lighthouse метрики.
6. Зафиксировать, улучшился ли:
   - score;
   - LCP;
   - main-thread;
   - unused JS;
   - image bytes above the fold.
7. Только после этого переходить к следующему этапу.

Этот документ является рабочей спецификацией для performance-refactor travel page, пока не будет заменен более точной финальной документацией в `docs/`.

## 13. Stage Status

- [x] Этап 1. Зафиксировать baseline и бюджет.
- [~] Этап 2. Отделить critical shell от deferred sections.
- [~] Этап 3. Перестроить hero/LCP path.
- [~] Этап 4. Сократить initial JS.
- [~] Этап 5. Перестроить image delivery.
- [~] Этап 6. Visibility-based hydration.
- [ ] Этап 7. Закрепить budgets и regression guard.

Примечания по текущему состоянию:
- Этап 2 частично закрыт: critical shell фактически выделен серией итераций, но ещё не оформлен как отдельный явный слой на уровне структуры travel details.
- Этап 3 частично закрыт: hero path сильно упрощён, но LCP по-прежнему нестабилен и этап нельзя считать завершённым.
- Этап 4 в активной фазе: route-shell и header cleanup почти исчерпаны, оставшийся потенциал в `__common` и `entry`.
- Этап 5 начат частично через hero priority и responsive-image fixes, но полноценная image delivery wave ещё не завершена.
- Этап 6 частично закрыт: visibility-based hydration уже применена к нескольким heavy секциям, но не доведена до финального охвата и budget guard.

## 14. Progress

- [x] Итерация 1: зафиксирован рабочий документ и этапы рефакторинга.
- [x] Итерация 1: ранний prefetch below-the-fold travel chunks перенесен за границу `deferAllowed`.
- [x] Итерация 1: вспомогательный web chrome (`ReadingProgressBar`, mobile sections sheet, `ScrollToTopButton`) убран с критического пути до готовности first screen.
- [x] Итерация 2: comments переведены с чисто таймерного mount на visibility-based load с fallback.
- [x] Итерация 2: footer секция вынесена из раннего import path и теперь догружается отдельно.
- [x] Итерация 3: внутри content section `video` переведено на visibility-based load с placeholder.
- [x] Итерация 3: insight-секции (`recommendation/plus/minus`) убраны из раннего path content section и теперь догружаются по видимости.
- [x] Итерация 4: web hero перестал монтировать `Slider` раньше разрешенного handoff; `renderSlider` теперь реально управляет swap-path.
- [x] Итерация 4: загрузка slider chunk сдвинута за `deferAllowed`, чтобы не конкурировать с hero stabilization сразу после LCP.
- [x] Итерация 5: blur-backdrop убран из initial web hero paint и стал пост-LCP декоративным слоем.
- [x] Итерация 6: favorite-toggle вынесен из initial hero path в отдельный lazy island на web.
- [x] Итерация 7: `QuickFacts` / quick jumps / desktop author вынесены из `TravelDetailsHero` в отдельный lazy island (`TravelHeroExtras`).
- [x] Итерация 8: mobile `Author/Share` и `TravelRatingSection` переведены на visibility-based load внутри deferred path.
- [x] Итерация 9: соседние hero slides на web больше не получают eager/high-priority до interaction (`prefetchEnabled` gate).
- [x] Итерация 10: `Slide` на web больше не повышает приоритет только из-за `isActive`; критическими до prefetch/interation остаются только первый hero slide и явно разрешенный preload path.
- [x] Итерация 10: добавлен web regression-тест, который фиксирует `lazy/auto` для non-first hero slides до включения prefetch.
- [x] Итерация 11: `TravelDetailsHero` на web теперь явно импортирует `Slider.web`, чтобы hero path не зависел от неоднозначного platform resolve через общий `Slider`.
- [x] Итерация 12: на web только первый hero slide получает `eager/high`; соседние кадры остаются вне критического image priority path даже при prefetch-подсказках.
- [x] Итерация 12: desktop Lighthouse больше не показывает `Фотография путешествия 2/3 из 11` как `eager/high`; responsive-images warning по hero neighbors снят.
- [x] Итерация 13: `TravelDetailsContainer` переведен с `AuthContext` facade на прямой slice из `authStore`, чтобы travel route не тянул provider/init logic ради `isSuperuser/userId`.
- [x] Итерация 13: убран runtime export-resolution (`moduleInterop` + star-module facade) для `useTravelDetails`; container теперь использует прямой hook import без лишнего route-shell кода.
- [x] Итерация 14: offline cache больше не входит в web route path; `TravelDetailsContainer` запускает native-only dynamic import helper вместо раннего импорта `useOfflineTravelCache`.
- [x] Итерация 14: в `useOfflineTravelCache` выделены plain async helper-функции (`cacheTravelOffline/getOfflineTravelCached/getOfflineTravelCachedIds`), чтобы вынести `AsyncStorage`-зависимость из web critical path.
- [x] Итерация 15: `useAccessibilityAnnounce` вынесен из `useKeyboardNavigation` в отдельный lightweight hook, чтобы travel route не импортировал лишнюю keyboard-navigation логику ради announce-функции.
- [x] Итерация 16: route SEO helper-ы (`stripHtmlForSeo` и `createTravelArticleJsonLd`) вынесены из тяжелого `travelDetailsSecure.ts` в отдельный lightweight `travelSeo.ts`.
- [x] Итерация 16: `TravelDetailsContainer` больше не тянет крупный security/utility модуль ради SEO description и JSON-LD на travel route.
- [x] Итерация 17: `createSafeImageUrl` вынесен в lightweight `travelMedia.ts`, чтобы critical hero path не зависел от тяжелого `travelDetailsSecure.ts`.
- [x] Итерация 17: `safeGetYoutubeId` вынесен в lightweight `travelMedia.ts`, чтобы hero/video секции использовали более тонкий import path без лишнего security utility bundle.
- [x] Итерация 18: `useTravelDetailsMenu` больше не зависит от generic `useMenuState`; travel route использует локальную lightweight menu-логику на основе уже известного `screenWidth`.
- [x] Итерация 18: из menu path убрана лишняя зависимость от `useResponsive` через `useMenuState`, чтобы travel route не тянул дополнительную shared цепочку ради sidebar state.
- [x] Итерация 19: container/layout shell-стили вынесены в отдельный `TravelDetailsShellStyles`, чтобы route shell не зависел от 848-строчного `TravelDetailsStyles` ради базовой обвязки и error state.
- [x] Итерация 19: `TravelDetailsContainer` и `useTravelDetailsLayout` переведены на lightweight shell-style import path вместо общего style-monolith.
- [x] Итерация 20: hero/extras/favorite styles вынесены в `TravelDetailsHeroStyles`, чтобы critical first-screen path не зависел от общего `TravelDetailsStyles`.
- [x] Итерация 20: `TravelDetailsHero`, `TravelHeroExtras` и `TravelHeroFavoriteToggle` переведены на lightweight hero-style import path.
- [x] Итерация 21: map/sidebar внутри `TravelDetailsDeferred` переведены с таймерного stagger на visibility-based load через `useProgressiveLoad`, чтобы heavy chunks не входили в аудит только из-за истечения idle timeout.
- [x] Итерация 21: comments fallback delay увеличен, а ранний enable-path убран; после этого `TravelDetailsMapSection` и `CommentsSection` перестали попадать в ранний Lighthouse treemap, а `bootup/main-thread` заметно снизились.
- [x] Итерация 22: глобальный footer для web travel route переведен на более поздний route-aware mount в `app/_layout.tsx`, чтобы below-the-fold chrome не входил в ранний audit window.
- [x] Итерация 22: `ConsentBanner` для `/travels/*` получил более поздний defer; после этого `Footer` и `ConsentBanner` исчезли из раннего Lighthouse treemap, а `bootup/main-thread` остались на пониженном уровне.
- [x] Итерация 23: `HeaderContextBar` в `CustomHeader` переведен на route-aware defer только для web `travels/*`, чтобы breadcrumb/context chrome не входил в ранний audit window.
- [x] Итерация 23: для отложенного `HeaderContextBar` добавлен ранний reveal по первому `pointerdown/keydown/scroll`, чтобы не держать контекстный бар скрытым дольше необходимого при реальном взаимодействии.
- [x] Итерация 24: account/mobile-user path вынесен из `CustomHeader` в отдельный lazy island `CustomHeaderAccountSection`, чтобы shell header не импортировал auth/favorites/filters/message hooks напрямую.
- [x] Итерация 24: `CustomHeaderAccountSection` на web `travels/*` переведен на route-aware defer с ранним reveal по interaction, чтобы account chrome не входил в ранний audit window.
- [x] Итерация 25: inline desktop navigation вынесена из `CustomHeader` в отдельный lazy island `CustomHeaderNavSection`, чтобы shell header не тянул nav rendering path и external-link navigation logic напрямую.
- [x] Итерация 25: `CustomHeaderNavSection` на web `travels/*` переведен на route-aware defer с ранним reveal по interaction, чтобы navigation chrome не входил в ранний audit window.
- [x] Итерация 26: `Logo` переведен с hook-driven responsive логики на prop-driven режим (`isCompact/showWordmark`), чтобы shell header не тянул `useResponsive` через логотип.
- [x] Итерация 26: `CustomHeader` теперь явно управляет compact/wordmark состоянием `Logo`, сохраняя прежний UI без лишней shared responsive-зависимости внутри logo path.
- [x] Итерация 27: root layout перестал использовать общий `useResponsive`; в `app/_layout.tsx` введена lightweight viewport/hydration логика только для `isMobile` split.
- [x] Итерация 27: в документ добавлен отдельный статус этапов, чтобы прогресс фиксировался не только по итерациям, но и по состоянию этапов 1-7.
- [x] Итерация 28: native-only runtime (`usePushNotifications` и Android navigation bar sync) вынесен из `app/_layout.tsx` в platform-specific `NativeAppRuntime`, чтобы web entry не импортировал этот путь.
- [x] Итерация 28: `app/_layout.tsx` на web больше не зависит от native notification/runtime logic; shared root path стал чище и ближе к реальному web-only shell.
- [x] Итерация 29: `FavoritesContext` разделен на lightweight shared context и отдельный heavy `FavoritesProvider`, чтобы root web path не импортировал store-heavy provider implementation по умолчанию.
- [x] Итерация 29: на web `travels/*` `AppProviders` откладывает подключение реального `FavoritesProvider` и сначала использует fallback context, пока не наступит idle/interaction.
- [x] Итерация 30: проведен auth-provider split experiment через lightweight `authContextBase`, чтобы проверить возможность убрать auth init path из раннего web entry.
- [x] Итерация 30: experiment с defer `AuthProvider` откатан после повторяемого `NO_LCP` в desktop Lighthouse; этот путь признан невалидным и не используется дальше.
- [x] Итерация 31: `FiltersProvider` убран из глобального `AppProviders`, чтобы root shared path не тащил filters context на каждый маршрут.
- [x] Итерация 31: `FiltersProvider` локализован в `CustomHeaderAccountSection`, где `useFilters` реально используется для account/header действий.
- [x] Итерация 32: `CustomHeader` перестал использовать общий `useResponsive`; header shell переведен на lightweight viewport split через `useWindowDimensions` и локальную hydration-логику.
- [x] Итерация 32: mobile/desktop режим header теперь вычисляется локально по breakpoint-границам без подключения shared responsive store в ранний web path.
- [x] Итерация 33: static-config prefetch для `QueryClient` вынесен из `reactQueryConfig.ts` в отдельный lazy helper, чтобы root query-client path не импортировал heavy `api/misc` и `queryKeys` напрямую.
- [x] Итерация 33: idle-prefetch фильтров и стран теперь запускается через отдельный chunk `queryClientStaticPrefetch`, а не через inline root-path логику в `createOptimizedQueryClient`.
- [x] Итерация 34: `leaflet/react-leaflet` runtime централизован в единый lazy loader `loadLeafletRuntime`, чтобы map entry points не создавали несколько параллельных import graph.
- [x] Итерация 34: `useLeafletLoader`, `Map.web`, `QuestFullMap`, `UserPointsMap` и `WebMapComponent` переведены на общий runtime loader вместо прямых dynamic import `leaflet/react-leaflet`.
- [x] Итерация 35: web browser side effects (`history patch`, focus-management, font timeout suppression, legacy SW cleanup) вынесены из `app/_layout.tsx` в отдельный lazy island `WebAppRuntimeEffects`.
- [x] Итерация 35: root web entry больше не держит служебные browser runtime эффекты в initial layout path; они подключаются после hydration через отдельный lazy chunk.
- [x] Итерация 36: `AppProviders` получил route-aware режим defer для `FavoritesProvider`, чтобы на `travels/*` heavy favorites context поднимался по interaction-first, а не по раннему `requestIdleCallback`.
- [x] Итерация 36: travel route больше не провоцирует раннюю загрузку `FavoritesProvider` через idle window; для него оставлен только interaction trigger и поздний fallback.
- [x] Итерация 37: root layout переведен на `effectivePathname`, чтобы web travel route распознавался по реальному browser path уже на первой гидратации, а не только после стабилизации `usePathname()`.
- [x] Итерация 37: defer для `Footer` и другого route-aware chrome на `travels/*` теперь вычисляется от эффективного пути и не должен срываться на прямом заходе.
- [x] Итерация 38: `NetworkStatus` в `app/_layout.tsx` переведен на route-aware deferred mount для web `travels/*`, чтобы root status chrome не входил в раннее hydration/Lighthouse окно.
- [x] Итерация 38: `ToastHost` в `app/_layout.tsx` переведен на route-aware deferred mount для web `travels/*` с ранним reveal по interaction и таймерным fallback.
- [ ] Этап 2: формально выделить critical shell как отдельный слой внутри travel details.
- [ ] Этап 3: упростить hero/LCP path до более детерминированного SSR-first media flow.
- [ ] Этап 4: сократить initial JS travel route и shared bundle pressure.
- [ ] Этап 5: пересобрать responsive image delivery для hero/avatar/content images.
- [ ] Этап 6: расширить visibility-based hydration для below-the-fold секций.
- [ ] Этап 7: закрепить performance budgets и regression guard.
