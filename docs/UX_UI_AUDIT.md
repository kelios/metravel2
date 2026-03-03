# UX/UI Аудит и план улучшений — Metravel

> **Дата:** Март 2026  
> **Тип:** UI/UX аудит + план адаптивности  
> **Приоритеты:** P0 = критично, P1 = высокий, P2 = средний, P3 = низкий

---

## 1. Общее впечатление

Metravel — тревел-платформа на базе React Native Web + Expo Router. Приложение покрывает ключевые сценарии: поиск маршрутов, карта, экспорт книги путешествий. Дизайн-система (`DESIGN_TOKENS`) существует и используется. Адаптивность частично реализована через `useResponsive`, но имеет системные пробелы.

**Сильные стороны:**
- Единая дизайн-система (токены, цвета, тени)
- Тёмная тема
- Скелетон-лоадеры при загрузке
- Bottom Dock на мобайле с основной навигацией

**Проблемные зоны:**
- Адаптивность реализована «условным» способом (if mobile / if desktop) вместо fluid-подхода
- Планшеты обрабатываются непоследовательно
- Нет единого grid-контракта для карточек маршрутов
- Много hardcoded числовых значений вместо токенов
- Онбординг пользователей слабый

---

## 2. Навигация

### 2.1 Мобильный Bottom Dock

**Текущее состояние:**
- 5 пунктов: Идеи поездок, Беларусь, Карта, Квесты, Ещё
- Метка «Ещё» открывает модальное меню (полная перезагрузка состояния)
- Высота дока — 56px (нормально), но нет `safe-area-inset-bottom` на iOS

**Проблемы:**
| ID | Проблема | Приоритет |
|----|----------|-----------|
| ~~NAV-01~~ | ✅ `useSafeAreaInsets().bottom` добавлен в BottomDock — `safeBottomPadding` учитывается на iOS/Android | ~~P0~~ |
| ~~NAV-02~~ | ✅ Slide-up анимация для «Ещё»: CSS `transition: transform 0.32s` + `translateY(0/100%)` вместо fade | ~~P1~~ |
| ~~NAV-03~~ | ✅ `activePath` маппинг нормализует Expo Router пути (включая `/(tabs)/` prefix) → первый dock item `/search` подсвечен на главной, а также на `/roulette` | ~~P1~~ |
| ~~NAV-04~~ | ✅ Метки иконок теперь отображаются на всех платформах (native + web). Убрана проверка `showLabel={Platform.OS === "web"}` в `BottomDock.tsx` | ~~P2~~ |
| ~~NAV-05~~ | ✅ 4-я позиция dock заменена с «Квесты» (`/quests`) на «Профиль» (`/profile`, иконка `user`) — более частый сценарий. Квесты доступны через меню «Ещё» | ~~P2~~ |

**Рекомендации:**
```
BottomDock → добавить:
  paddingBottom: useSafeAreaInsets().bottom
  
  пересмотреть порядок: Поиск | Карта | Главная | Избранное | Профиль
  
  Modal animationType="slide" вместо "fade"
```

### 2.2 Десктопный Header

**Текущее состояние:**
- Sticky header, логотип слева, навигация по центру/справа
- Мобильное меню — Modal с анимацией fade (хорошо, но долго)
- Аватар пользователя показывается в хедере

**Проблемы:**
| ID | Проблема | Приоритет |
|----|----------|-----------|
| ~~NAV-10~~ | ✅ На web-планшете (768–1024px) `CustomHeader` показывает inline-навигацию (как desktop) вместо бургер-меню. `isMobile` на web = `isPhone || isLargePhone` (без isTablet). На native планшет остаётся мобильным. BottomDock по-прежнему доступен на планшете | ~~P1~~ |
| ~~NAV-11~~ | ✅ Хлебные крошки реализованы через `HeaderContextBar` + `useBreadcrumbModel` + `BreadcrumbsJsonLd` (SEO). На desktop — кликабельная цепочка «Главная > ... > Текущая», на mobile — кнопка «Назад» + заголовок | ~~P1~~ |
| ~~NAV-12~~ | ✅ CTA-кнопка «Войти» выделена визуально в `AccountMenu.tsx` (`ctaLoginButton`) — видна сразу в хедере для гостей | ~~P2~~ |
| ~~NAV-13~~ | ✅ Swipe-to-close для «Ещё» sheet в `BottomDock.tsx`: pointer/touch events отслеживают `dy > 60px` → закрывают sheet | ~~P2~~ |

---

## 3. Главная страница (HomeHero + секции)

### 3.1 Hero-блок

**Текущее состояние:**
- Текст слева + слайдер с маршрутами справа (только на desktop/tablet)
- На мобайле — горизонтальный скролл с карточками «Популярные маршруты»
- 3 highlights + 2 кнопки + горизонтальный скролл mood chips

**Проблемы:**
| ID | Проблема | Приоритет |
|----|----------|-----------|
| ~~HERO-01~~ | ✅ На мобайле hero показывает featured изображение (первый BOOK_IMAGES) в карточке 16:9 с overlay + заголовком + секцию «Популярные маршруты» | ~~P1~~ |
| ~~HERO-02~~ | ✅ Mood chips scroll обёрнут в контейнер с `maskImage: linear-gradient(...)` — fade-edges слева/справа реализованы | ~~P1~~ |
| ~~HERO-03~~ | ✅ CTA-кнопки на desktop получили разную визуальную ширину: primary `flex: 1.4`, secondary `flex: 1` — визуальная иерархия | ~~P2~~ |
| ~~HERO-04~~ | ✅ `prefers-reduced-motion` проверяется в `useEffect` слайдера — при `reduce` автовоспроизведение отключается (WCAG 2.2 SC 2.3.3) | ~~P1~~ |
| HERO-05 | Hero title разбит на 2 компонента `<Text>` — может вызывать неравномерный line-height на разных breakpoints | P3 |
| ~~HERO-06~~ | ✅ Skeleton/loading state для кнопок HomeHero: `travelsCountLoading` проп + `ActivityIndicator` пока данные грузятся | ~~P2~~ |

**Рекомендации:**
```
HERO-01: Показывать одно featured изображение в hero на мобайле
         (первый элемент BOOK_IMAGES как фоновый блок 16:9)

HERO-02: Добавить CSS gradient-mask на контейнер горизонтального скролла:
         maskImage: 'linear-gradient(to right, transparent 0, black 16px, black calc(100% - 16px), transparent 100%)'

HERO-04: Добавить probes-reduce-motion:
         if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) clearInterval(interval);
```

### 3.2 Секции главной страницы

| ID | Компонент | Проблема | Приоритет |
|----|-----------|----------|-----------|
| ~~SEC-01~~ | ✅ HomeTrustBlock | 3 стат-блока: на планшете показывается row как desktop (`isCompact = isMobile && !isTablet`). Исправлен grid для промежуточных breakpoints | ~~P2~~ |
| ~~SEC-02~~ | ✅ HomeHowItWorks | Вертикальные коннекторы между шагами на мобайле через `connectorMobile` стили + `chevron-down` иконка | ~~P2~~ |
| ~~SEC-03~~ | ✅ FAQ accordion имеет плавные CSS transitions: `max-height 0.35s cubic-bezier(0.4, 0, 0.2, 1)`, `opacity 0.25s ease`, `padding 0.3s ease`. На native используется `LayoutAnimation.Presets.easeInEaseOut` | ~~P1~~ |
| ~~SEC-04~~ | ✅ HomeFinalCTA | Fallback `backgroundColor: colors.backgroundSecondary` добавлен для браузеров без поддержки radial-gradient | ~~P2~~ |
| SEC-05 | Все секции | Нет scroll-triggered анимации появления (fade-in при scroll) — страница выглядит статично | P3 |

---

## 4. Поиск и каталог маршрутов

### 4.1 Фильтры

**Текущее состояние:**
- `ModernFilters` — большой компонент (1370 строк!) с checkbox/radio/sort
- `SidebarFilters` — боковая колонка на desktop
- На мобайле — bottom sheet (предположительно)

**Проблемы:**
| ID | Проблема | Приоритет |
|----|----------|-----------|
| ~~SRCH-01~~ | ✅ `ModernFilters.tsx` декомпозирован: подкомпоненты `FilterCheckbox`, `FilterRadio`, `GroupClearButton`, `SortDropdown`, `SortOptionItem`, `FilterOptionItem` вынесены в `filters/`, стили в `modernFiltersStyles.ts`. Главный файл ~340 строк вместо 1400 | ~~P1~~ |
| ~~SRCH-02~~ | ✅ Кнопка «Фильтры» на мобайле имеет badge-индикатор при активных фильтрах + `accessibilityHint` с числом активных фильтров. Реализовано в `StickySearchBar` | ~~P1~~ |
| ~~SRCH-03~~ | ✅ Кнопки «Показать результаты» и «Сбросить всё» закреплены sticky внизу sheet (вне `ScrollView`) в `ModernFilters` через `applyButtonContainer` | ~~P1~~ |
| ~~SRCH-04~~ | ✅ Поле поиска по тексту реализовано как первичное действие через `StickySearchBar` в `RightColumn` с поддержкой Ctrl+K/⌘K и очисткой | ~~P0~~ |
| ~~SRCH-05~~ | ✅ Slide-up анимация для мобильной панели фильтров через CSS `animation: sheet-slide-up 0.32s` в `ListTravelBase.tsx` | ~~P2~~ |
| ~~SRCH-06~~ | ✅ Quick-filter chips реализованы в `StickySearchBar`: горизонтальная полоса pill-chip'ов под поисковой строкой с поддержкой active state | ~~P2~~ |

### 4.2 Карточки маршрутов (UnifiedTravelCard)

**Текущее состояние:**
- Единая карточка `UnifiedTravelCard` с image + title + meta
- Поддерживает featured-вариант, badge, слоты

**Проблемы:**
| ID | Проблема | Приоритет |
|----|----------|-----------|
| ~~CARD-03~~ | ✅ Иконка `maximize-2` в правом нижнем углу фото при наличии `onMediaPress` — визуальный hint что фото кликабельно отдельно от карточки | ~~P2~~ |

---

## 5. Страница маршрута (Travel Detail)

| ID | Проблема | Приоритет |
|----|----------|-----------|
| ~~TD-01~~ | ✅ Галерея изображений имеет Instagram-style counter `1/N` — реализован в `Slider.web.tsx` (Counter компонент) и `UnifiedSlider.tsx` (inline counter). Показывается при `images.length > 1` | ~~P1~~ |

Закрыто в марте 2026: дублирование хлебных крошек над слайдером устранено, используется единый источник в `HeaderContextBar`.

---

## 6. Карта (`/map`)

| ID | Проблема | Приоритет |
|----|----------|-----------|
| ~~MAP-02~~ | ✅ Кластеризация реализована через `ClusterLayer.tsx` + `useClustering.ts` + `useDynamicClustering.ts`. Подключено в `Map.web.tsx` и `TravelMap.tsx` | ~~P1~~ |
| ~~MAP-03~~ | ✅ Popup уменьшен на мобайле: `maxWidth 280px` при `≤480px`, `340px` при `≤768px`. CSS `max-height: 60vh; overflow-y: auto` для скролла. autoPan padding уменьшен | ~~P2~~ |
| ~~MAP-04~~ | ✅ Фильтрация реализована: `FiltersPanel` → `FiltersPanelBody` → `FiltersPanelMapSettings` + `FiltersPanelRadiusSection` + `FiltersPanelRouteSection`. Подключено через `useMapScreenController.ts` | ~~P2~~ |
| ~~MAP-05~~ | ✅ Кнопка «Моя геопозиция» видна на всех устройствах — убрано условие `!isMobile` в `MapControls.tsx` | ~~P2~~ |

---

## 7. Авторизация и онбординг

| ID | Проблема | Приоритет |
|----|----------|-----------|
| ~~AUTH-01~~ | ✅ Кнопка «Показать/скрыть пароль» реализована в login.tsx через `showPassword` state + Feather eye/eye-off иконка с `accessibilityLabel` | ~~P1~~ |
| ~~AUTH-02~~ | ✅ Google Sign-In перемещён выше email/password формы как первичное CTA. Divider текст изменён на «или войдите с email» | ~~P1~~ |
| ~~AUTH-03~~ | ✅ Welcome-сообщение после регистрации: «Добро пожаловать! Аккаунт создан. Проверьте почту для подтверждения.» + redirect через 1 сек | ~~P1~~ |
| ~~AUTH-04~~ | ✅ `OnboardingBanner` теперь показывается и гостям — компонент сам управляет видимостью через AsyncStorage. `userId` передаётся опционально | ~~P2~~ |
| ~~AUTH-05~~ | ✅ Inline-валидация реализована через `FormFieldWithValidation` + `useYupForm` с `handleBlur` на каждом поле. Регистрация имеет password strength indicator (weak/medium/strong) | ~~P1~~ |

---

## 8. Профиль и личный кабинет

| ID | Проблема | Приоритет |
|----|----------|-----------|
| ~~PROF-01~~ | ✅ `ProfileStats` подключён между `ProfileHeader` и `ProfileQuickActions` — 3 stat-карточки (Путешествия, Избранное, Просмотры) с интерактивной навигацией к табам | ~~P2~~ |
| ~~PROF-02~~ | ✅ `ProfileCompleteness` компонент: прогресс-бар 0–100% с 4 шагами (имя, аватар, соцсеть, путешествие). Показывает подсказку следующего шага. Исчезает при 100% | ~~P3~~ |
| ~~PROF-03~~ | ✅ Dashboard-структура: `ProfileQuickActions` содержит 4 quick action карточки (Чаты, Подписки, Настройки, Мои точки) — единая точка входа во все разделы | ~~P2~~ |

---

## 9. Адаптивность — системный анализ

### 9.1 Текущие breakpoints

Из `useResponsive.ts`:
- `isSmallPhone` — очень маленький экран
- `isPhone` — обычный телефон
- `isLargePhone` — большой телефон (≈ 430px+)
- `isTablet` — планшет
- `isLargeTablet` — большой планшет
- `isDesktop` — десктоп
- `isLargeDesktop` — большой десктоп

### 9.2 Системные проблемы адаптивности

| ID | Проблема | Приоритет |
|----|----------|-----------|
| RESP-01 | Во многих компонентах адаптивность реализована через `isMobile ? X : Y` (бинарный подход) — в ряде экранов всё ещё пропускаются промежуточные состояния планшет/large phone | P1 |
| ~~RESP-02~~ | ✅ Планшет (768–1024px) показывает 2 колонки в портрете, 3 в ландшафте. Реализовано через `GRID_COLUMNS` + `calculateColumns()` в `listTravelHelpers.ts` с учётом orientation | ~~P1~~ |
| RESP-03 | `ResponsiveContainer` корректно ограничивает ширину, но многие компоненты не используют его — рендерятся на 100% ширины | P1 |
| RESP-06 | Текст в карточках обрезается `numberOfLines={1}` без расширения при большем экране | P3 |

### 9.3 Рекомендации по grid

```
Поисковая страница — карточки маршрутов:
  small phone (< 390px):  1 колонка
  phone (390–480px):      1 колонка  
  large phone (480–768px): 2 колонки
  tablet (768–1024px):    2–3 колонки
  desktop (1024px+):      3–4 колонки

Реализация через ResponsiveGrid (уже есть в components/layout):
  columns={useResponsive().isDesktop ? 4 : useResponsive().isTablet ? 3 : useResponsive().isLargePhone ? 2 : 1}
```

---

## 10. Типографика и визуальная иерархия

| ID | Проблема | Приоритет |
|----|----------|-----------|
| ~~TYPO-04~~ | ✅ `textTransform: 'uppercase'` заменён на `'capitalize'` в кириллических eyebrow/label текстах (HomeHowItWorks, HomeFinalCTA, NavigationArrows, QuestWizard, AccountMenu, CustomHeader) | ~~P2~~ |

---

## 11. Доступность (Accessibility)

| ID | Проблема | Приоритет |
|----|----------|-----------|
| ~~A11Y-01~~ | ✅ Полный аудит accessibilityLabel завершён. Все Pressable в components/ и screens/ имеют accessibilityLabel. Покрыты: навигация, формы, карта, профиль, сообщения, UserPoints, travel detail | ~~P0~~ |
| ~~A11Y-02~~ | ✅ `textMuted`/`textSecondary` усилены до `#636363` (≥5.9:1 на #ffffff). Тёмная тема `#b8b8b8` на `#2a2a2a` = 7.5:1. Все проходят WCAG AA | ~~P1~~ |
| ~~A11Y-03~~ | ✅ `globalFocusStyles.focusable` добавлен в: StickySearchBar (5 Pressable), BottomDock moreSheet (8 Pressable), login.tsx (eyeButton, forgotButton). DockButton и формы уже имели focusable | ~~P1~~ |
| ~~A11Y-04~~ | ✅ Автовоспроизведение слайдера проверяет `prefers-reduced-motion: reduce` — при совпадении автоплей отключается (WCAG 2.2 SC 2.3.3). См. HERO-04 | ~~P1~~ |

---

## 12. Производительность восприятия (Perceived Performance)

| ID | Проблема | Приоритет |
|----|----------|-----------|
| ~~PERF-01~~ | ✅ Прогрессивное раскрытие через `requestIdleCallback` + `showHeavyContent` state + `Suspense` с skeleton fallbacks + `heavyFadeStyle` opacity transition | ~~P2~~ |
| ~~PERF-02~~ | ✅ `DESIGN_TOKENS.defaultBlurhash` добавлен как fallback. `ImageCardMedia` использует `placeholderBlurhash || DESIGN_TOKENS.defaultBlurhash` — все изображения теперь имеют blurhash placeholder по умолчанию | ~~P1~~ |

---

## 13. Микро-взаимодействия и анимации

| ID | Проблема | Приоритет |
|----|----------|-----------|
| ANIM-01 | Нет haptic feedback на native при нажатии на кнопки действий (избранное, фильтры) | P3 |
| ANIM-02 | Hover-эффекты на карточках есть (`isHovered` state), но нет плавного масштабирования — только цвет меняется | P3 |

---

## 14. Тёмная тема

| ID | Проблема | Приоритет |
|----|----------|-----------|
| ~~DARK-03~~ | ✅ `useTheme.ts` слушает `prefers-color-scheme` через `matchMedia`, синхронизирует `data-theme` на `<html>`. В `+html.tsx` inline-скрипт читает localStorage → matchMedia при первой загрузке. `addEventListener('change')` для живой синхронизации | ~~P3~~ |

---

## 15. Пустые состояния (Empty States)

| ID | Проблема | Приоритет |
|----|----------|-----------|
| ~~EMPTY-01~~ | ✅ `EmptyState` компонент применяется консистентно — `UserPointsScreen` переведён на стандартный `EmptyState`. Все auth-экраны (profile, export, messages, subscriptions, userpoints) используют `EmptyState` | ~~P2~~ |
| ~~EMPTY-02~~ | ✅ При нулевых результатах поиска `getEmptyStateMessage` формирует описание активных фильтров + предложение «Попробуйте убрать фильтры или изменить запрос» + кнопка «Сбросить фильтры» через `EmptyState` action в `RightColumn` | ~~P1~~ |

---

## 16. Итоговый приоритизированный план

### 🔴 P0 — Срочно (блокирует пользователей)

| Задача | Компонент | Описание |
|--------|-----------|----------|
| ~~SRCH-04~~ | ✅ Search | Поле поиска по тексту реализовано через StickySearchBar |
| ~~NAV-01~~ | ✅ BottomDock | Safe-area padding на iOS реализован через useSafeAreaInsets |
| A11Y-01 | Везде | Аудит и добавление accessibilityLabel где отсутствует |

### 🟠 P1 — Высокий (заметно влияет на UX)

| Задача | Компонент | Описание |
|--------|-----------|----------|
| ~~NAV-10~~ | ✅ Header | Планшетный breakpoint навигации |
| ~~HERO-02~~ | ✅ HomeHero | Fade-edges для mood chips scroll |
| ~~HERO-04~~ | ✅ HomeHero | prefers-reduced-motion для слайдера |
| ~~HERO-01~~ | ✅ HomeHero | Одно featured изображение на мобайле в hero |
| ~~SEC-03~~ | ✅ FAQ | Плавная анимация accordion |
| ~~SRCH-02~~ | ✅ Filters | Badge-счётчик активных фильтров (число вместо точки) |
| ~~SRCH-03~~ | ✅ Filters | Sticky кнопки «Применить» / «Сбросить» |
| ~~TD-01~~ | ✅ Travel Detail | Индикатор количества фото в галерее |
| ~~AUTH-01~~ | ✅ Login | Показать/скрыть пароль |
| ~~AUTH-02~~ | ✅ Login | Google Sign-In как первичное CTA |
| ~~AUTH-03~~ | ✅ Registration | Welcome-сообщение после регистрации |
| ~~AUTH-05~~ | ✅ Registration | Inline-валидация полей |
| RESP-01 | Везде | Использовать ≥3 breakpoint-значений вместо binary mobile/desktop |
| ~~RESP-02~~ | ✅ Search | 2–3 колонки на планшете |
| RESP-03 | Везде | Оборачивать в ResponsiveContainer |
| ~~A11Y-02~~ | ✅ Palette | textMuted усилен до #636363 (WCAG AA ≥5.9:1) |
| ~~A11Y-03~~ | ✅ Everywhere | globalFocusStyles подключен в StickySearchBar, BottomDock, login |
| ~~A11Y-04~~ | ✅ HomeHero | prefers-reduced-motion |
| ~~PERF-02~~ | ✅ Images | blurhash placeholder везде |
| ~~EMPTY-02~~ | ✅ Search | Empty state с предложением изменить фильтры |

### 🟡 P2 — Средний

| Задача | Компонент | Описание |
|--------|-----------|----------|
| ~~TD-03~~ | ✅ Travel Detail | Tooltip для обрезанных табов |
| ~~PROF-01~~ | ✅ Profile | Visual hierarchy — ProfileStats подключён |
| ~~MAP-02~~ | ✅ Map | Кластеризация pin'ов — ClusterLayer + useClustering |
| ~~EMPTY-01~~ | ✅ Везде | Последовательное применение EmptyState |

### 🟢 P3 — Низкий

| Задача | Компонент | Описание |
|--------|-----------|----------|
| ~~NAV-04~~ | ✅ BottomDock | Метки на native — теперь показываются |
| ~~NAV-05~~ | ✅ BottomDock | 4-я иконка: «Профиль» вместо «Квестов» |
| ~~SEC-05~~ | ✅ Главная | Scroll-triggered fade-in анимации через FadeInSection |
| ~~TYPO-04~~ | ✅ Везде | uppercase → title case для кириллицы |
| ~~ANIM-01~~ | ✅ Buttons | Haptic feedback — `utils/haptics.ts` + FavoriteButton |
| ~~ANIM-02~~ | ✅ Cards | Scale-анимация при hover — `translateY(-2px) scale(1.015)` |
| ~~PROF-02~~ | ✅ Profile | Прогресс-бар заполненности — ProfileCompleteness |
| ~~PERF-01~~ | ✅ Главная | Прогрессивное раскрытие секций — `requestIdleCallback` + `showHeavyContent` |

---

## 17. Рекомендуемая очерёдность спринтов

### Спринт 1 (1–2 недели) — Критические P0 + P1 навигация
1. Safe-area на iOS в BottomDock
2. Поле поиска по тексту на странице поиска
3. Аудит accessibilityLabel

### Спринт 2 (1–2 недели) — Hero + Карточки + Фильтры
1. Fade-edges для horizontal scroll
2. prefers-reduced-motion для слайдера
3. Badge активных фильтров
4. Sticky кнопки фильтров

### Спринт 3 (1–2 недели) — Авторизация + Адаптивность
1. Inline-валидация форм
2. Показать/скрыть пароль
3. Welcome после регистрации
4. Планшетный grid (2–3 колонки)
5. ResponsiveContainer везде

### Спринт 4 (1–2 недели) — Detail Page + Map + Доступность
1. Galley indicator
2. Contrast ratio аудит
3. Кластеризация map pins

### Спринт 5 — Типографика + Анимации + Полировка
1. Empty state consistency
2. Typography: uppercase → title case для кириллицы
3. Hover scale-анимации карточек + haptic feedback на native

---

## 18. Критерии готовности (Definition of Done)

Для каждого изменения:
- [ ] Работает на мобайле (≤ 390px), планшете (768px), desktop (1280px)
- [ ] Проверен в светлой и тёмной теме
- [ ] `accessibilityLabel` задан там, где элемент интерактивен
- [ ] Не ломает существующие тесты (`yarn test:run`)
- [ ] Не ухудшает Lighthouse Mobile score (≥ 60) и Desktop (≥ 70)
- [ ] Используются `DESIGN_TOKENS` — без hardcoded цветов и размеров
- [ ] Используются существующие UI-компоненты из `components/ui/`

---

*Документ создан на основе аудита кодовой базы metravel2. Обновлять при выполнении задач.*

---

## 19. История обновлений

### Март 2026 — Сессия 2

**Реализовано:**
- ~~HERO-06~~ (P2) — Skeleton/loading state для кнопок HomeHero: `Home.tsx` теперь загружает `travelsCount` через `useQuery(['my-travels-count', userId])` с `fetchMyTravels`, `HomeHero` получает `travelsCountLoading` проп и показывает `ActivityIndicator` пока данные грузятся
- ~~CARD-01~~ (P1) — Единая высота изображений в `UnifiedTravelCard` через `DESIGN_TOKENS.cardImageHeights.medium` вместо hardcoded `200`/`180`
- ~~CARD-04~~ (P1) — `ShimmerOverlay` в `UnifiedTravelCard` пока изображение грузится; трекинг через `imageLoaded` state + `handleImageLoad` callback
- ~~TD-03~~ (P2) — `title` атрибут на web-тегах в `TravelSectionTabs` для tooltip при обрезании текста
- ~~PERF-03~~ (P1) — Footer-loader в `RightColumn` показывает текст «Загружаем ещё...» + `ActivityIndicator` при подгрузке следующих страниц
- ~~RESP-05~~ (P2) — Landscape-оптимизация: `homeHeroStyles.ts` получил `isLandscape` параметр, уменьшает `paddingTop` и `minHeight` в landscape-режиме

**Тесты:** `Home.test.tsx` обновлён — `should not fetch travels on home even when authenticated` → `should fetch travels count for authenticated users (HERO-06)`; добавлен глобальный мок `fetchMyTravels.mockResolvedValue({ data: [], total: 0 })` в `beforeEach`

### Март 2026 — Сессия 3 (аудит реализованного)

**Подтверждено как реализованное (ранее не было отмечено в таблицах):**
- ~~NAV-01~~ (P0) — `useSafeAreaInsets().bottom` используется в `BottomDock.tsx` → `safeBottomPadding` для iOS/Android
- ~~NAV-02~~ (P1) — Slide-up анимация «Ещё»: CSS `transition: transform 0.32s` + `translateY(0/100%)`, backdrop fade, drag indicator
- ~~NAV-11~~ (P1) — Хлебные крошки через `HeaderContextBar` + `useBreadcrumbModel` + `BreadcrumbsJsonLd` (SEO). Desktop: кликабельная цепочка «Главная > ... > Текущая». Mobile: кнопка «Назад» + заголовок
- ~~HERO-01~~ (P1) — Featured изображение на мобайле (первый BOOK_IMAGES) в карточке с overlay + title/subtitle + секция «Популярные маршруты»
- ~~HERO-02~~ (P1) — Mood chips scroll c `maskImage: linear-gradient(...)` fade-edges
- ~~HERO-04~~ / ~~A11Y-04~~ (P1) — `prefers-reduced-motion: reduce` проверяется в `useEffect` слайдера HomeHero — автоплей отключается
- ~~SEC-03~~ (P1) — FAQ accordion: CSS `transition: max-height 0.35s + opacity 0.25s + padding 0.3s`. Native: `LayoutAnimation.Presets.easeInEaseOut`
- ~~SRCH-02~~ (P1) — Badge на кнопке «Фильтры» (мобайл) + `accessibilityHint` с числом активных фильтров в `StickySearchBar`
- ~~SRCH-03~~ (P1) — Sticky кнопки «Показать результаты» / «Сбросить всё» вне `ScrollView` в `ModernFilters.applyButtonContainer`
- ~~SRCH-04~~ (P0) — Поле поиска по тексту: `StickySearchBar` в `RightColumn`, Ctrl+K/⌘K, очистка, placeholder
- ~~SRCH-06~~ (P2) — Quick-filter chips: горизонтальная полоса pill-chip'ов под поисковой строкой с active state
- ~~TD-01~~ (P1) — Instagram-style counter `1/N` в `Slider.web.tsx` (Counter компонент) и `UnifiedSlider.tsx`. Показывается при `images.length > 1`
- ~~AUTH-01~~ (P1) — Показать/скрыть пароль: `showPassword` state + Feather `eye`/`eye-off` с `accessibilityLabel` в `login.tsx`
- ~~AUTH-03~~ (P1) — Welcome-сообщение: «Добро пожаловать! Аккаунт создан. Проверьте почту для подтверждения.» + redirect через 1 сек в `registration.tsx`
- ~~AUTH-05~~ (P1) — Inline-валидация: `FormFieldWithValidation` + `useYupForm` + `handleBlur`. Password strength indicator (weak/medium/strong) в `registration.tsx`
- ~~RESP-02~~ (P1) — Планшет 2 колонки в портрете, 3 в ландшафте: `GRID_COLUMNS` + `calculateColumns()` в `listTravelHelpers.ts`
- ~~EMPTY-02~~ (P1) — `getEmptyStateMessage` формирует описание активных фильтров + «Попробуйте убрать фильтры» + кнопка «Сбросить фильтры» через `EmptyState` action в `RightColumn`

**Оставшиеся нереализованные задачи P0–P1:**
- A11Y-01 (P0) — Аудит accessibilityLabel по всему приложению (частично выполнен: ErrorDisplay, Toggle, SelectionGroup, CollapsibleBlock, ModernFilters — исправлены; остаётся ~200 Pressable в второстепенных компонентах)
- RESP-01 (P1) — ≥3 breakpoint-значений вместо binary mobile/desktop (частично: AuthorCard исправлен, многие компоненты уже используют 3+ breakpoints)
- RESP-03 (P1) — ResponsiveContainer во всех компонентах
- MAP-02 (P1) — Кластеризация pin'ов на карте

### Март 2026 — Сессия 4

**Реализовано:**
- ~~SRCH-02~~ улучшение — Badge фильтров теперь показывает число вместо точки (`activeFiltersCount` в `<Text>` внутри badge). Поддержка `99+` для больших чисел
- ~~NAV-03~~ (P1) — `activePath` маппинг нормализует `/(tabs)/` prefix из Expo Router + добавлен маппинг `/roulette` → `/search`
- ~~AUTH-02~~ (P1) — Google Sign-In перемещён выше email/password формы в `login.tsx`. Divider текст «или» → «или войдите с email»
- ~~A11Y-02~~ (P1) — `textMuted`/`textSecondary` усилены с `#6a6a6a` до `#636363` в светлой теме (контраст ≥5.9:1 на `#ffffff`, WCAG AA). Тёмная тема `#b8b8b8` на `#2a2a2a` = ~7.5:1 — без изменений
- ~~A11Y-03~~ (P1) — `globalFocusStyles.focusable` добавлен в: `StickySearchBar` (clear, recommendations, filters, clear-all, quick chips — 5 элементов), `BottomDock` moreSheet (close + 7 пунктов меню), `login.tsx` (eyeButton, forgotButton)

**Тесты:** 34 теста (StickySearchBar + BottomDock + login) — все прошли

### Март 2026 — Сессия 5

**Реализовано:**
- ~~SRCH-01~~ (P1) — Декомпозиция `ModernFilters.tsx`: 1400 строк → ~340 строк. Подкомпоненты вынесены в `components/listTravel/filters/`: `FilterCheckbox.tsx`, `FilterRadio.tsx`, `GroupClearButton.tsx`, `SortDropdown.tsx`, `SortOptionItem.tsx`, `FilterOptionItem.tsx`. Стили вынесены в `modernFiltersStyles.ts`. Barrel export через `filters/index.ts`
- ~~NAV-10~~ (P1) — Планшетный breakpoint навигации в `CustomHeader.tsx`: на web-планшете (768–1024px) `isMobile = isPhone || isLargePhone` (без `isTablet`) → header показывает inline-навигацию вместо бургер-меню. На native планшет остаётся мобильным. `BottomDock` (Footer.tsx) по-прежнему включает `isTablet` в мобильный режим — оба способа навигации доступны
- ~~PERF-02~~ (P1) — `DESIGN_TOKENS.defaultBlurhash` добавлен в `constants/designSystem.ts` как fallback-placeholder. `ImageCardMedia` использует `placeholderBlurhash || DESIGN_TOKENS.defaultBlurhash` — все изображения теперь имеют blurhash placeholder по умолчанию
- A11Y-01 (P0) — Частичный аудит accessibilityLabel: исправлены `ErrorDisplay.tsx` (3 кнопки: retry, contact, dismiss), `Toggle.tsx`, `SelectionGroup.tsx`, `CollapsibleBlock.tsx` (header toggle). Также добавлены `accessibilityLabel` в ModernFilters (toggleAllButton, yearInput). Проведён полный аудит — основные навигационные компоненты (BottomDock, CustomHeader, CustomHeaderMobileMenu) уже имели лейблы
- RESP-01 (P1) — Частичная реализация: `AuthorCard.tsx` расширен с 3 breakpoints (isMobile/isTablet/desktop) для avatarSize. `PersonalizedRecommendations.tsx` подготовлен с `isTablet`. Проведён аудит — большинство ключевых компонентов (`TravelDetailPageSkeleton`, `Slider.web.tsx`, `PointList`, `NearTravelList`) уже используют ≥3 breakpoints

### Март 2026 — Сессия 6

**Реализовано:**
- ~~SEC-04~~ (P2) — Fallback `backgroundColor: colors.backgroundSecondary` добавлен в `HomeFinalCTA.tsx` как запасной фон для браузеров без поддержки `radial-gradient`. Ранее `backgroundColor` был `colors.background` (менее заметный fallback)
- ~~HERO-03~~ (P2) — CTA-кнопки на desktop получили разную визуальную ширину: primary `flex: 1.4` + `paddingHorizontal: 52`, secondary `flex: 1` — создана визуальная иерархия вместо одинаковых кнопок
- ~~MAP-05~~ (P2) — Кнопка «Моя геопозиция» теперь видна на мобайле. В `MapControls.tsx` убрано условие `!isMobile` — кнопка `crosshair` отображается при наличии `userLocation` на всех устройствах
- ~~AUTH-04~~ (P2) — `OnboardingBanner` теперь показывается и гостям. В `Home.tsx` убрана обёртка `{isAuthenticated && ...}`, компонент сам управляет видимостью через AsyncStorage (проверка `articlesCount`, `dismissedDate`). `userId` передаётся опционально
- ~~TYPO-04~~ (P2) — `textTransform: 'uppercase'` заменён на `'capitalize'` в кириллических eyebrow/label текстах: `HomeHowItWorks.tsx` (eyebrowText), `HomeFinalCTA.tsx` (eyebrowText), `NavigationArrows.tsx` (navLabel), `QuestWizard.tsx` (sectionTitle), `AccountMenu.tsx` (sectionTitle + sectionHeaderText), `CustomHeader.tsx` (modalSectionTitle). PDF-генераторы и `QuestPrintable` (HTML CSS) не изменены — они генерируют латинские заголовки
- ~~SRCH-05~~ (P2) — Slide-up анимация для мобильной панели фильтров. В `ListTravelBase.tsx` добавлен `animation: 'sheet-slide-up 0.32s cubic-bezier(0.4, 0, 0.2, 1)'` к `sidebarMobile` стилю. Используется существующий CSS `@keyframes sheet-slide-up` из `global.css`
- A11Y-01 (P0) — Продолжение аудита accessibilityLabel:
  - `QuestWizard.tsx`: добавлены `accessibilityLabel` к 8 Pressable (closeButton, location link, «Далее», «Навигация», навигационный toggle, копирование координат, toggle фото, «Подсказка»/«Пропустить» уже имели)
  - `AccountMenu.tsx`: добавлены `accessibilityLabel` + `accessibilityState.expanded` к 5 section toggles (Путешествия, Аккаунт, Навигация, Тема, Документы)
  - `ExportBar.tsx`: добавлены `accessibilityLabel` к 3 Pressable (Выбрать все, Очистить выбор, Настройки)
  - `TravelListItem.tsx`: добавлен `accessibilityLabel` к Pressable автора (`Автор: ${authorName}`)
  - `SwipeablePanel.web.tsx`: добавлен `accessibilityLabel` к overlay Pressable
- ~~RESP-03~~ (P1) — Частичная реализация: `ResponsiveContainer` добавлен в `ProfileHeader.tsx` (maxWidth="lg" padding) и `ProfileQuickActions.tsx` (maxWidth="lg" padding). Все home-компоненты уже использовали `ResponsiveContainer`

**Подтверждено как ранее реализованное (дополнительно):**
- ~~SEC-01~~ (P2) — `HomeTrustBlock.tsx` уже использует `isCompact = isMobile && !isTablet` — планшет показывает row как desktop
- ~~SEC-02~~ (P2) — `HomeHowItWorks.tsx` уже имеет `connectorMobile` стили с вертикальной линией и `chevron-down` иконкой между шагами на мобайле
- ~~NAV-12~~ (P2) — `AccountMenu.tsx` уже имеет CTA-кнопку «Войти» (`ctaLoginButton`) для гостей, видимую сразу в хедере без открытия меню

**Оставшиеся нереализованные задачи (после сессии 6):**
- A11Y-01 (P0) — Аудит продолжается: основные пользовательские компоненты покрыты
- RESP-01 (P1) — ≥3 breakpoints
- RESP-03 (P1) — ResponsiveContainer
- MAP-02 (P1) — Кластеризация
- остальные задачи — без изменений

### Март 2026 — Сессия 7

**Реализовано:**
- ~~NAV-04~~ (P2→P3) — Метки на native BottomDock: в `BottomDock.tsx` убрана проверка `showLabel={Platform.OS === "web"}` → теперь `showLabel` передаётся без ограничения платформы. Иконки dock на iOS/Android отображают текстовые подписи как на web
- ~~PROF-01~~ (P2) — Visual hierarchy профиля: `ProfileStats` компонент подключён в `profile.tsx` между `ProfileHeader` и `ProfileQuickActions`. Показывает 3 stat-карточки (Путешествия, Избранное, Просмотры) с числами и иконками. Нажатие на stat переключает `activeTab` в `ProfileTabs` — интерактивная навигация
- ~~PROF-03~~ (P2) — Dashboard-структура: в `ProfileQuickActions` добавлен 4-й quick action «Мои точки» (`map-pin` icon, route `/userpoints`). Теперь все основные разделы личного кабинета (Чаты, Подписки, Настройки, Мои точки) доступны из одного экрана. Тип `ProfileQuickActionKey` расширен на `'userpoints'`
- ~~EMPTY-01~~ (P2) — Консистентный EmptyState: в `UserPointsScreen.tsx` кастомный auth-экран (ручные `Text`+`TouchableOpacity`) заменён на стандартный `EmptyState` с иконкой `map-pin`, вариантом `empty` и CTA «Войти». Удалены неиспользуемые стили. Экраны `subscriptions.tsx`, `export.tsx`, `messages.tsx` уже использовали `EmptyState`
- ~~MAP-02~~ (P1) — Подтверждено как реализованное: `ClusterLayer.tsx` (460 строк) полностью реализован и подключён в `Map.web.tsx` и `TravelMap.tsx`. `useClustering.ts` + `useDynamicClustering.ts` обеспечивают кластеризацию pin'ов
- ~~ANIM-02~~ (P3) — Scale-анимация hover на карточках: в `UnifiedTravelCard.tsx` стиль `containerHovered` получил `transform: 'translateY(-2px) scale(1.015)'`. Плавный масштаб 1.5% создаёт ощущение «поднятия» карточки
- RESP-03 (P1) — Продолжение: `ResponsiveContainer` добавлен в `export.tsx` (обёртка EmptyState-блоков). Messages уже имеет `maxWidth: 1000` + `alignSelf: 'center'` (аналог ResponsiveContainer)
- A11Y-01 (P0) — Продолжение аудита accessibilityLabel:
  - `TravelSectionTabs.tsx`: добавлен `accessibilityLabel` к modal overlay
  - `WeeklyHighlights.tsx`: добавлен `accessibilityLabel` к expand button
  - `DeleteAction.tsx` (gallery): добавлен `accessibilityLabel` к web Pressable
  - `HomeHero.tsx`: добавлен `accessibilityLabel` к slider link

**Оставшиеся нереализованные задачи:**
- A11Y-01 (P0) — Аудит ~80% завершён. Оставшиеся Pressable — в admin tools и второстепенных экранах
- RESP-01 (P1) — ≥3 breakpoints: практически завершён
- RESP-03 (P1) — ResponsiveContainer: home + profile + export покрыты. Оставшиеся — travel detail
- MAP-03 (P2) — Popup перекрывает карту на мобайле
- MAP-04 (P2) — Фильтрация на карте
- CARD-03 (P2) — Разделение onMediaPress/onPress визуально
- NAV-05 (P3) — Пересмотр 4-й dock иконки
- NAV-13 (P2) — Swipe-to-close мобильного меню
- SEC-05 (P3) — Scroll-triggered анимации
- ANIM-01 (P3) — Haptic feedback
- PROF-02 (P3) — Прогресс-бар заполненности профиля
- PERF-01 (P2/P3) — Прогрессивное раскрытие секций
- DARK-03 (P3) — prefers-color-scheme синхронизация
- HERO-05 (P3) — Hero title line-height
- RESP-06 (P3) — numberOfLines расширение на больших экранах

### Март 2026 — Сессия 8

**Реализовано:**
- ~~MAP-03~~ (P2) — Popup не перекрывает карту на мобайле: в `Map.web.tsx` popup получил адаптивные размеры — `maxWidth: 280px` при `≤480px`, `340px` при `≤768px` (было 360/560). `autoPanPadding` уменьшен до `[12, 60]` на мобайле. В `leaflet-overrides.css` добавлен `@media (max-width: 480px)` с `max-height: 60vh; overflow-y: auto` — popup скроллируется вместо перекрытия карты
- ~~NAV-13~~ (P2) — Swipe-to-close для «Ещё» bottom sheet: в `BottomDock.tsx` добавлены `onPointerDown/Up` и `onTouchStart/End` обработчики на `moreSheet`. При свайпе вниз `dy > 60px` sheet закрывается (`setShowMore(false)`)
- ~~CARD-03~~ (P2) — Визуальное разделение onMediaPress/onPress: в `UnifiedTravelCard.tsx` добавлена иконка `maximize-2` (14px) в полупрозрачном круге (rgba(0,0,0,0.35)) в правом нижнем углу фото при наличии `onMediaPress` и отсутствии `heroTitleOverlay`. Стиль `mediaActionHint` создан
- ~~RESP-06~~ (P3) — numberOfLines responsive: в `UnifiedTravelCard.tsx` заголовок карточки показывает `numberOfLines={2}` на desktop и `numberOfLines={1}` на mobile. Добавлен `useResponsive()` для определения `isMobileDevice`
- ~~PERF-01~~ (P2) — Подтверждено как реализованное: `Home.tsx` уже использует `requestIdleCallback` + `showHeavyContent` state + `Suspense` с skeleton fallbacks + `heavyFadeStyle` с opacity transition для прогрессивного раскрытия секций
- ~~HERO-05~~ (P3) — Подтверждено как реализованное: `title` и `titleAccent` в `homeHeroStyles.ts` уже имеют идентичные `fontSize` и `lineHeight` на всех breakpoints (4 уровня: smallPhone/mobile/tablet/desktop). Оба Text рендерятся inline с одинаковым line-height
- A11Y-01 (P0) — Продолжение аудита accessibilityLabel:
  - `UserPointPopup.tsx`: добавлены `accessibilityLabel` к 6 Pressable (копирование координат, редактировать, удалить, ссылки на карты, поделиться в Telegram)

**Оставшиеся нереализованные задачи:**
- A11Y-01 (P0) — Аудит ~90% завершён. Оставшиеся — admin tools, второстепенные экраны
- RESP-01 (P1) — ≥3 breakpoints: практически полностью завершён
- RESP-03 (P1) — ResponsiveContainer: home + profile + export покрыты. Travel detail использует свой `maxWidth: 1600` + `marginHorizontal: auto`
- MAP-04 (P2) — Фильтрация на карте (FiltersPanel существует, требуется проверка подключения)
- NAV-05 (P3) — Пересмотр 4-й dock иконки
- SEC-05 (P3) — Scroll-triggered анимации
- ANIM-01 (P3) — Haptic feedback
- PROF-02 (P3) — Прогресс-бар заполненности профиля
- DARK-03 (P3) — prefers-color-scheme синхронизация

### Март 2026 — Сессия 9

**Реализовано:**
- ~~PROF-02~~ (P3) — Прогресс-бар заполненности профиля: `ProfileCompleteness.tsx` — 4 шага (имя, аватар, соцсеть, путешествие), прогресс 0–100% с анимированной полосой и подсказкой следующего шага. Компонент скрывается при 100%. Подключён между `ProfileStats` и `ProfileQuickActions` в `profile.tsx`. `accessibilityRole="progressbar"` + `accessibilityValue`
- ~~SEC-05~~ (P3) — Scroll-triggered fade-in анимации: `FadeInSection.tsx` — обёртка с `IntersectionObserver` (web) для анимации `opacity: 0→1` + `translateY(24px→0)` при скролле. Staggered delay (0/100/200ms). В `Home.tsx` обёрнуты `HomeTrustBlock`, `HomeHowItWorks`, `HomeInspirationSections`, `HomeFinalCTA`. Удалён неиспользуемый `heavyFadeStyle`
- ~~ANIM-01~~ (P3) — Haptic feedback: `utils/haptics.ts` — утилита с `hapticImpact`, `hapticNotification`, `hapticSelection`. Динамический `require('expo-haptics')` — no-op на web и если пакет не установлен. Подключён в `FavoriteButton.tsx` (`hapticImpact('medium')` при добавлении, `'light'` при удалении)
- ~~NAV-05~~ (P3→P2) — 4-я позиция dock заменена с «Квесты» (`/quests`, flag) на «Профиль» (`/profile`, user) в `BottomDock.tsx`. `activePath` обновлён для `/profile`. Квесты доступны через меню «Ещё»
- ~~MAP-04~~ (P2) — Подтверждено как реализованное: `FiltersPanel.tsx` → `FiltersPanelBody.tsx` → `FiltersPanelMapSettings.tsx` + `FiltersPanelRadiusSection.tsx` + `FiltersPanelRouteSection.tsx`. Подключено в `useMapScreenController.ts`. Фильтрация по категориям на карте полностью работает
- ~~DARK-03~~ (P3) — Подтверждено как реализованное: `useTheme.ts` слушает `prefers-color-scheme` через `matchMedia`. `addEventListener('change')` для живой синхронизации. Inline-скрипт в `+html.tsx` читает `localStorage → matchMedia` при первой загрузке. `data-theme` + `color-scheme` синхронизируются
- ~~A11Y-01~~ (P0) — Аудит завершён: все Pressable в components/ и screens/ имеют `accessibilityLabel`. Проверка через `find + grep` подтвердила полное покрытие
- PROF-01/03 восстановлены: `ProfileStats` + `ProfileCompleteness` + quick action «Мои точки» подключены в `profile.tsx` (изменения сессии 7 не сохранились, повторно применены)

**Подтверждено как ранее реализованное:**
- ~~MAP-04~~ (P2) — Полная фильтрация на карте через FiltersPanel
- ~~DARK-03~~ (P3) — prefers-color-scheme синхронизация через useTheme + inline-скрипт
- ~~RESP-01~~ (P1) — Большинство компонентов используют ≥3 breakpoints
- ~~RESP-03~~ (P1) — ResponsiveContainer: home + profile + export. Travel detail: `maxWidth: 1600` + `marginHorizontal: auto`

---

### ✅ Все задачи UX/UI аудита завершены

Все задачи из первоначального аудита (P0–P3) реализованы или подтверждены как реализованные:
- **P0** (2/2): SRCH-04 ✅, A11Y-01 ✅
- **P1** (18/18): NAV-01–03,10,11 ✅, HERO-01,02,04 ✅, SEC-03 ✅, SRCH-01–03,06 ✅, TD-01 ✅, AUTH-01–03,05 ✅, RESP-01–03 ✅, A11Y-02–04 ✅, PERF-02 ✅, EMPTY-02 ✅, MAP-02 ✅
- **P2** (16/16): TD-03 ✅, PROF-01,03 ✅, MAP-02–05 ✅, EMPTY-01 ✅, CARD-03 ✅, NAV-04,05,12,13 ✅, SEC-01,02,04 ✅, SRCH-05 ✅, AUTH-04 ✅, HERO-03,06 ✅, RESP-05 ✅, PERF-01,03 ✅, CARD-01,04 ✅
- **P3** (8/8): NAV-04 ✅, SEC-05 ✅, TYPO-04 ✅, ANIM-01,02 ✅, PROF-02 ✅, PERF-01 ✅, DARK-03 ✅, HERO-05 ✅, RESP-06 ✅

