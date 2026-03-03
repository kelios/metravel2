# 📱 Android & Mobile UX — План доработок и улучшений

> **Дата:** Март 2026  
> **Автор:** Android Engineering  
> **Статус:** Новый  
> **Платформа:** Android (Expo + React Native)  
> **Приоритеты:** P0 = критично, P1 = высокий, P2 = средний, P3 = низкий (nice to have)

---

## 0. Контекст

Приложение MeTravel — тревел-платформа на React Native (Expo SDK) + Expo Router. На данный момент UX/UI аудит (docs/UX_UI_AUDIT.md) и Performance Plan (docs/PERFORMANCE_IMPROVEMENT_PLAN.md) **полностью закрыты** по web-вектору. Этот документ фокусируется на **Android-специфичных** доработках и улучшении мобильного UX для native-платформы, которые остались за рамками предыдущих аудитов.

### Текущее состояние Android
- Сборка через EAS Build (dev APK / prod AAB)
- `versionCode: 2`, пакет `by.metravel.app`
- Hermes engine, Proguard отключён
- Deep links настроены (`metravel.by`)
- Минимум SDK не указан явно (берётся из Expo defaults ≈ API 24)
- Google Sign-In — только web (native Android flow не реализован)
- Push-уведомления — не реализованы (`expo-notifications` не подключён)
- Splash screen — базовая конфигурация (статичный PNG, белый фон)

---

## 1. 🔴 P0 — Критичные проблемы

### AND-01 | Android App Links — верификация и тестирование

**Проблема:** `intentFilters` в `app.json` настроены для `metravel.by`, но:
- `autoVerify: true` требует `.well-known/assetlinks.json` на сервере — не проверено, работает ли
- Нет fallback-навигации внутри приложения при переходе по deep link на несуществующий маршрут
- `[...missing].tsx` — есть catch-all, но не адаптирован для native deep link ошибок

**Частично реализовано:**
- Создан `public/.well-known/assetlinks.json` (шаблон) — требует замены SHA-256 fingerprint из release keystore
- Нужна серверная верификация: файл должен быть доступен по `https://metravel.by/.well-known/assetlinks.json`

**Оставшиеся действия:**
1. ⚠️ Заменить SHA-256 fingerprint в `assetlinks.json` на реальный из release keystore
2. Проверить доступность файла на prod сервере после деплоя
3. Протестировать deep links через `adb shell am start`

---

### ~~AND-02~~ | ✅ Package naming — несоответствие

**Проблема:** В `app.json` пакет = `by.metravel.app`, а в `android/app/build.gradle` namespace и applicationId = `com.yourcompany.metravel`. Это шаблонные значения, которые не были обновлены.

**Реализовано:** `build.gradle` — namespace и applicationId исправлены на `by.metravel.app`. `AndroidManifest.xml` — scheme исправлен с `com.yourcompany.metravel` на `by.metravel.app`.

---

### AND-03 | Google Sign-In на Android native

**Проблема:** `GoogleSignInButton.tsx` загружает Google SDK через web-скрипт и работает **только на web**. На Android native нет аутентификации через Google.

**Действия:**
1. Интегрировать `expo-auth-session` или `@react-native-google-signin/google-signin` для native flow
2. Добавить Android `clientId` (type = Android) в Google Cloud Console
3. Добавить SHA-1 fingerprint debug/release keystore в Cloud Console
4. Реализовать platform-split: `GoogleSignInButton.native.tsx` + `GoogleSignInButton.web.tsx`
5. Подключить к существующему `loginWithGoogle(credential)` в `authStore`

---

### ~~AND-04~~ | ✅ Permissions — избыточные и устаревшие

**Проблема:** В `app.json` запрошены permissions, которые создают проблемы в Google Play:
- `ACCESS_BACKGROUND_LOCATION` — требует отдельного review в Play Console и обоснования. Для тревел-приложения фоновая геолокация обычно не нужна
- `READ_EXTERNAL_STORAGE` / `WRITE_EXTERNAL_STORAGE` — deprecated начиная с API 33+, заменены на `READ_MEDIA_IMAGES` / `READ_MEDIA_VIDEO` (которые уже есть)
- Дублирование: `ACCESS_COARSE_LOCATION` + `android.permission.ACCESS_COARSE_LOCATION` — дублируется с full-qualified именем

**Реализовано:** Из `app.json` удалены: `ACCESS_BACKGROUND_LOCATION`, `READ_EXTERNAL_STORAGE`, `WRITE_EXTERNAL_STORAGE`, дублирующиеся `android.permission.ACCESS_*`. Из `AndroidManifest.xml` удалены: `ACCESS_BACKGROUND_LOCATION`, `READ_EXTERNAL_STORAGE`, `WRITE_EXTERNAL_STORAGE`, `requestLegacyExternalStorage`.

---

## 2. 🟠 P1 — Высокий приоритет

### AND-05 | Push-уведомления

**Проблема:** `expo-notifications` не установлен. Для тревел-приложения уведомления — ключевой retention канал.

**Сценарии уведомлений:**
- Новые сообщения в чате
- Ответ на комментарий
- Новый маршрут в избранном регионе
- Напоминание о незаконченном путешествии (черновик)
- Еженедельный дайджест рекомендаций

**Действия:**
1. Установить `expo-notifications` + настроить FCM (Firebase Cloud Messaging)
2. Добавить `google-services.json` в production конфигурацию
3. Реализовать регистрацию push token при авторизации → отправка на бэкенд
4. Notification channels для Android (Сообщения, Обновления, Рекомендации)
5. Обработка foreground/background/killed state уведомлений
6. Deep link из notification → целевой экран

---

### ~~AND-06~~ | ✅ Splash Screen — анимированный переход

**Проблема:** Splash screen — статичный PNG на белом фоне. Белая вспышка в тёмной теме.

**Реализовано:**
- `SplashScreen.hideAsync()` перенесён из `RootLayout` в `RootLayoutNav` — скрывается только после загрузки шрифтов (а не сразу)
- Добавлена конфигурация `android.splash` в `app.json` с dark-вариантом (`backgroundColor: "#1a1a2e"`)
- `SplashScreen.preventAutoHideAsync()` уже вызывался для native

---

### ~~AND-07~~ | ✅ BackHandler — полноценная обработка кнопки «Назад»

**Проблема:** `BackHandler` используется только в `useTravelWizard.ts`.

**Реализовано:** Создан хук `useAndroidBackHandler` (`hooks/useAndroidBackHandler.ts`):
- На главном экране: двойное нажатие «Назад» для выхода с Toast «Нажмите ещё раз для выхода»
- Принимает `onDismiss` callback для закрытия модальных окон
- Подключён в `BottomDock.tsx` — «Ещё» sheet закрывается по кнопке «Назад»
- Дефолтный fallback — `router.back()` через Expo Router

---

### ~~AND-08~~ | ✅ StatusBar — консистентная настройка

**Проблема:** `StatusBar` настроена только в `modal.tsx` и `about.tsx`. На остальных экранах — системные defaults.

**Реализовано:** Глобальный `<StatusBar style="auto" />` из `expo-status-bar` добавлен в `_layout.tsx` (ThemedContent). Стиль `auto` автоматически переключается между light/dark в зависимости от системной темы.

---

### ~~AND-09~~ | ✅ Keyboard handling — единообразная обработка клавиатуры

**Проблема:** `KeyboardAvoidingView` используется в 6+ компонентах Travel Wizard, но:
- Нет единообразного `keyboardVerticalOffset` (на Android vs iOS разное)
- В чатах (`ChatView.tsx`) клавиатура может перекрывать поле ввода
- TextInput в поиске и фильтрах — нет автоматического scroll to field при фокусе

**Реализовано:**
1. Создан компонент `KeyboardAwareContainer` (`components/ui/KeyboardAwareContainer.tsx`) с правильными offsets для Android/iOS
2. Android: `behavior="height"` (вместо `undefined`) во всех 6 Travel Wizard шагах и ChatView
3. iOS: `behavior="padding"` сохранён
4. `android.softwareKeyboardLayoutMode: "resize"` добавлен в `app.json` для корректного adjustResize
5. Web: KeyboardAvoidingView не рендерится (не нужен)

---

### AND-10 | Offline mode — базовая поддержка

**Проблема:** `useNetworkStatus` и API client имеют offline-обработку, но UX при потере сети:
- Нет persistent баннера/индикатора отсутствия сети
- Нет offline-доступа к просмотренным маршрутам
- Нет retry-механизма с экспоненциальной задержкой для пользователя

**Частично реализовано:**
1. ✅ React Query `networkMode: 'offlineFirst'` добавлен в `utils/reactQueryConfig.ts` — запросы используют кэш при отсутствии сети, автоматический refetch при восстановлении
2. ✅ `NetworkStatus` компонент уже подключён глобально в `_layout.tsx` — persistent баннер при потере сети с анимированным появлением/скрытием
3. ✅ `refetchOnReconnect: true` уже включён в React Query config

**Оставшиеся действия:**
1. Кэшировать последние просмотренные маршруты через AsyncStorage для offline-просмотра
2. Кнопка «Повторить» при ошибке сети вместо пустого экрана (в ErrorDisplay)
3. Индикатор синхронизации при восстановлении связи

---

### ~~AND-11~~ | ✅ Proguard/R8 — включить минификацию

**Проблема:** `enableProguardInReleaseBuilds = false` в `build.gradle`.

**Реализовано:**
1. `enableProguardInReleaseBuilds` изменён с `false` на `true` в `build.gradle`
2. Расширены ProGuard rules в `proguard-rules.pro`: добавлены правила для Hermes, Expo modules, React Native core, gesture-handler, safe-area-context, OkHttp
3. Ожидаемый эффект: APK/AAB размер −15–25%

---

## 3. 🟡 P2 — Средний приоритет

### AND-12 | Adaptive Icon — Material You

**Проблема:** Adaptive icon настроен (`adaptive-icon.png`), но:
- Нет monochrome icon для Android 13+ (Material You themed icons)
- Нет round icon для старых лаунчеров
- Фон — белый (#ffffff), может выглядеть чужеродно на тёмных темах Material You

**Действия:**
1. Добавить `monochromeImage` в `app.json`:
   ```json
   "adaptiveIcon": {
     "foregroundImage": "./assets/images/adaptive-icon.png",
     "monochromeImage": "./assets/images/monochrome-icon.png",
     "backgroundColor": "#ffffff"
   }
   ```
2. Создать monochrome вариант иконки (силуэт/контур)
3. Рассмотреть динамический backgroundColor, соответствующий brand

---

### AND-13 | Жесты и навигация — native feel

**Проблема:** Навигация работает через Expo Router, но:
- Нет swipe-back на Android (iOS-style gesture back)
- Haptic feedback используется только в `FavoriteButton` — не покрывает остальные интерактивные элементы
- Нет shared element transitions между карточкой и detail page

**Частично реализовано:**
1. ✅ `expo-haptics` установлен — haptic feedback теперь работает на native
2. ✅ Haptic на BottomDock tab нажатие (`hapticSelection`)
3. ✅ Haptic на pull-to-refresh (Home, Profile) — `hapticImpact('light')`
4. ✅ Haptic на FAB «Создать маршрут» — `hapticImpact('medium')`
5. ✅ Добавление/удаление из избранного (FavoriteButton) — уже было

**Оставшиеся действия:**
1. Haptic на подтверждение отправки формы (travel wizard submit)
2. Long press на карточке маршрута (share action)
2. Shared element transition для перехода карточка → travel detail (React Navigation 7+ / Expo Router v4)
3. Overscroll glow кастомизация (бренд-цвет вместо стандартного)

---

### ~~AND-14~~ | ✅ Pull-to-Refresh — расширить на все списки

**Проблема:** `RefreshControl` используется в:
- `PointsListGrid` ✅
- `ActivityFeed` ✅
- `TravelListPanel` ✅
- `articles.tsx` ✅
- **Отсутствует** на: главной странице, странице поиска маршрутов, профиле, избранном, истории

**Реализовано:**
1. ✅ `RefreshControl` добавлен на главную страницу (`Home.tsx`) — `invalidateQueries()` при pull-to-refresh
2. ✅ `refreshing`/`onRefresh` добавлены в профиль (`profile.tsx`) — обновление stats и данных через `loadTravels` + `loadUserInfo`
3. ✅ `refreshing`/`onRefresh` добавлены в избранное (`favorites.tsx`) — FlashList native pull-to-refresh
4. ✅ `refreshing`/`onRefresh` добавлены в историю (`history.tsx`) — FlashList native pull-to-refresh
5. Используется `invalidateQueries` из React Query для корректной инвалидации (Home), прямые вызовы API для Profile

---

### AND-15 | Image Picker — улучшение для Android

**Проблема:** Загрузка фото для маршрутов и аватара работает, но:
- Нет crop/resize перед загрузкой → отправляются полноразмерные фото (5–10 MB)
- Нет множественного выбора фото (gallery grid)
- Нет preview перед загрузкой
- Нет progress bar при загрузке

**Действия:**
1. Использовать `expo-image-picker` с `allowsMultipleSelection: true`
2. Добавить crop перед загрузкой (аватар: square, маршрут: 16:9 / free)
3. Сжимать изображения до max 1920px / quality 0.8 перед отправкой
4. Показывать progress bar при upload
5. Добавить preview grid выбранных фото перед финальной загрузкой

---

### AND-16 | Animations — native performance

**Проблема:** `react-native-reanimated` установлен, но анимации часто используют JS-driven подходы вместо native-driven.

**Действия:**
1. Перевести BottomDock sheet на `Reanimated.SharedValue` + `useAnimatedStyle` (вместо CSS transitions)
2. Перевести FAQ accordion на native `LayoutAnimation` (✅ уже есть на native) — проверить плавность
3. Карточки маршрутов: native spring animation при press (scale down → up)
4. Skeleton loaders: native shimmer через Reanimated (вместо CSS animation)
5. Page transitions: shared element transitions для карточка → travel detail

---

### AND-17 | Biometric authentication

**Проблема:** Авторизация — только email/password и Google (web). Нет быстрого повторного входа.

**Действия:**
1. Интегрировать `expo-local-authentication` (fingerprint / face unlock)
2. После первого успешного входа — предложить включить биометрию
3. При повторном запуске — биометрическая проверка вместо логин-экрана
4. Fallback на PIN/password если биометрия недоступна

---

### AND-18 | Scoped Storage и Android 14+ compatibility

**Проблема:** Приложение запрашивает `READ_EXTERNAL_STORAGE`/`WRITE_EXTERNAL_STORAGE`, но начиная с Android 10+ действует Scoped Storage.

**Действия:**
1. Проверить, что все файловые операции (экспорт PDF, сохранение фото) используют `MediaStore` API или `expo-file-system`
2. Убедиться в совместимости с Android 14 (API 34) — Photo picker, partial media access
3. Протестировать экспорт книги путешествий на Android 13+ устройствах
4. Проверить targetSdkVersion — рекомендуется ≥ 34 для Google Play (с ноября 2024 обязательно)

---

## 4. 🟢 P3 — Улучшения (nice to have)

### AND-19 | Widget — быстрый доступ к избранным маршрутам

**Действия:**
- Android App Widget (1×1 или 4×2) со случайным маршрутом дня
- Tap → open travel detail в приложении
- Реализация через `react-native-widget-extension` или native Kotlin widget

---

### AND-20 | Shortcuts — App Shortcuts

**Действия:**
- Long press на иконке → shortcuts: «Поиск», «Карта», «Избранное»
- Реализация через Expo config plugin или `app.json` shortcuts

---

### AND-21 | Picture-in-Picture для карты

**Действия:**
- При переходе с карты на другой экран — PiP окно с мини-картой
- Полезно при навигации по маршруту

---

### AND-22 | Отслеживание маршрута в реальном времени (GPS tracking)

**Действия:**
- Запись GPS-трека во время поездки
- Фоновая геолокация (требует `ACCESS_BACKGROUND_LOCATION` + Play review)
- Генерация GPX из записанного трека
- Привязка фото к точкам на маршруте по timestamp

---

### AND-23 | Share — нативный шаринг маршрутов

**Проблема:** `expo-sharing` подключен, но не видно deep integration:
- Нет Share Sheet для маршрутов с preview image
- Нет Short Dynamic Links для маршрутов
- Нет шаринга в социальные сети с rich preview

**Действия:**
1. Добавить кнопку «Поделиться» на странице маршрута
2. Использовать `expo-sharing` с preview image и title
3. Генерировать short link через Firebase Dynamic Links (или server-side)
4. Принимать shared content (share target): ссылки на другие тревел-ресурсы → парсить и добавлять в «Хочу посетить»

---

### AND-24 | Dark theme — Android system sync

**Проблема:** Тёмная тема работает через `useTheme.ts` + `matchMedia` (web-подход). На Android native:
- Нет `Appearance.addChangeListener` для native dark mode
- Splash screen — всегда белый фон (вспышка в dark mode)
- Navigation bar (внизу, системная) — не перекрашивается

**Действия:**
1. Использовать `Appearance` API из React Native для синхронизации с Android system dark mode
2. Navigation bar color через `expo-navigation-bar`
3. Splash screen dark вариант (AND-06)

---

### AND-25 | Performance monitoring — Android Vitals

**Действия:**
1. Интегрировать Firebase Performance Monitoring (или Sentry Performance)
2. Отслеживать: cold start time, warm start time, screen render time
3. Мониторить ANR (Application Not Responding) через Play Console
4. Целевые метрики:
   - Cold start: ≤ 2 с
   - Screen transition: ≤ 300 мс
   - ANR rate: < 0.5%

---

### AND-26 | Accessibility — Android TalkBack

**Проблема:** `accessibilityLabel` добавлены повсеместно (A11Y-01 закрыт), но Android-специфичные a11y не проверены:
- TalkBack навигация (swipe-based)
- `accessibilityRole` на custom components
- Content grouping (`accessible={true}` на контейнерах)
- Минимальный touch target 48×48dp (Material Design guideline)

**Действия:**
1. Провести manual TalkBack audit на Android устройстве
2. Проверить touch target size — минимум 48dp (Android Material Design)
3. Добавить `importantForAccessibility` на декоративные элементы
4. Протестировать navigation flow с TalkBack: Главная → Поиск → Маршрут → Назад

---

## 5. 📊 Специфические Android UI-паттерны

### AND-27 | Material Design 3 alignment

Хотя приложение использует собственную дизайн-систему (`DESIGN_TOKENS`), для Android native feel рекомендуется:

| Элемент | Текущее | Рекомендация |
|---------|---------|-------------|
| Bottom Navigation | Custom BottomDock (56px) | Проверить высоту 80dp (M3 spec), ripple effect |
| FAB | Нет | Добавить FAB «Добавить маршрут» на странице поиска/карты |
| Snackbar | Toast (custom) | Snackbar с action button (Material style) |
| Bottom Sheet | CSS transitions (web) | `@gorhom/bottom-sheet` для native performance |
| Top App Bar | Custom Header | Проверить elevation/scroll behavior (collapse on scroll) |
| Cards | UnifiedTravelCard | Проверить elevation/shadow на Android (не box-shadow) |
| Ripple | Нет | `android_ripple` prop на Pressable для Material ripple effect |
| Chip | Custom Chip | Проверить Material Chip spec (32dp height, 8dp padding) |
| Switch | Custom Toggle | Проверить Material Switch spec (track/thumb) |

**Действия:**
1. ✅ Добавить `android_ripple={{ color: 'rgba(0,0,0,0.12)' }}` на все Pressable — реализовано на BottomDock, UnifiedTravelCard, Button, IconButton
2. Рассмотреть `@gorhom/bottom-sheet` для «Ещё» menu и фильтров (вместо CSS-based sheet)
3. ✅ FAB «Создать маршрут» для авторизованных пользователей — `FloatingActionButton.tsx` + подключён на search page
4. Collapse-on-scroll для header на длинных списках

---

### AND-28 | Edge-to-edge display (Android 15+)

**Проблема:** Android 15 делает edge-to-edge обязательным. Контент должен отрисовываться под system bars.

**Частично реализовано:**
1. ✅ `expo-navigation-bar` установлен — Android navigation bar синхронизируется с темой приложения
2. ✅ `NavigationBar.setBackgroundColorAsync(colors.background)` + `setButtonStyleAsync()` в `_layout.tsx`
3. ✅ StatusBar `translucent` + `backgroundColor: "transparent"` — уже было

**Оставшиеся действия:**
1. Проверить `react-native-safe-area-context` — покрывает ли system bars на Android
2. Карта: edge-to-edge с translucent status bar и navigation bar
3. Галерея: полноэкранный просмотр с скрытыми system bars
4. Проверить поведение при gestural navigation (3-button nav vs gesture nav)

---

## 6. 🔧 Инфраструктура сборки

### ~~AND-29~~ | ✅ build.gradle — versionCode sync

**Проблема:** `versionCode: 1` в `build.gradle` vs `versionCode: 2` в `app.json`.

**Реализовано:** `versionCode` и `versionName` в `build.gradle` синхронизированы с `app.json`. Добавлен комментарий что EAS Build перезаписывает эти значения из `app.json`.

---

### AND-30 | Hermes — проверка и оптимизация

**Текущее:** Hermes включён по умолчанию через Expo.

**Действия:**
1. Проверить, что bytecode precompilation включена для release builds
2. Протестировать startup time с и без Hermes (для baseline)
3. Убедиться, что все polyfills совместимы с Hermes (Intl, Temporal, etc.)

---

### AND-31 | APK/AAB size optimization

**Действия:**
1. Включить Proguard/R8 (AND-11)
2. Проверить `enableSeparateBuildPerCPUArchitecture` — разделение по ABI (arm64-v8a, armeabi-v7a, x86_64)
3. Удалить неиспользуемые assets из bundle
4. Проверить `assetBundlePatterns: ["**/*"]` — слишком широкий, может включать лишнее
5. Целевой размер AAB: ≤ 50 MB (Play Store limit 150 MB, но меньше = лучше conversion)

---

## 7. 🔐 Безопасность

### ~~AND-32~~ | ✅ Secure storage

**Текущее:** `expo-secure-store` подключён.

**Реализовано:** Аудит подтвердил:
1. Auth token хранится через `setSecureItem('userToken', ...)` в `api/auth.ts` и `stores/authStore.ts` — на native это `expo-secure-store`
2. Refresh token хранится отдельно через тот же механизм
3. `android:allowBackup="false"` установлен в `AndroidManifest.xml` — предотвращает утечку данных через бэкапы
4. Certificate pinning — отложено (P3)

---

### ~~AND-33~~ | ✅ Network security config

**Реализовано:**
1. Создан `android/app/src/main/res/xml/network_security_config.xml`:
   - `cleartextTrafficPermitted="false"` по умолчанию (HTTPS only в production)
   - Исключения для dev-серверов: `localhost`, `10.0.2.2`, `192.168.50.36`
2. Подключён в `AndroidManifest.xml` через `android:networkSecurityConfig="@xml/network_security_config"`

---

## 8. 📋 Итоговая матрица приоритетов

| ID | Задача | Приоритет | Усилия | Влияние |
|----|--------|-----------|--------|---------|
| AND-01 | App Links verification | P0 | Низкое | 🔴 Высокое |
| ~~AND-02~~ | ✅ Package name fix | ~~P0~~ | Низкое | 🔴 Высокое |
| AND-03 | Google Sign-In native | P0 | Среднее | 🔴 Высокое |
| ~~AND-04~~ | ✅ Permissions cleanup | ~~P0~~ | Низкое | 🔴 Высокое |
| AND-05 | Push-уведомления | P1 | Высокое | 🔴 Высокое |
| ~~AND-06~~ | ✅ Splash screen | ~~P1~~ | Низкое | 🟠 Среднее |
| ~~AND-07~~ | ✅ BackHandler | ~~P1~~ | Среднее | 🟠 Высокое |
| ~~AND-08~~ | ✅ StatusBar | ~~P1~~ | Низкое | 🟠 Среднее |
| ~~AND-09~~ | ✅ Keyboard handling | ~~P1~~ | Среднее | 🟠 Высокое |
| AND-10 | Offline mode | P1 | Высокое | 🟠 Высокое |
| ~~AND-11~~ | ✅ Proguard/R8 | ~~P1~~ | Среднее | 🟡 Среднее |
| AND-12 | Adaptive Icon M3 | P2 | Низкое | 🟡 Среднее |
| AND-13 | Жесты и анимации | P2 | Среднее | 🟡 Среднее |
| ~~AND-14~~ | ✅ Pull-to-Refresh | ~~P2~~ | Низкое | 🟡 Среднее |
| AND-15 | Image Picker | P2 | Среднее | 🟡 Среднее |
| AND-16 | Native animations | P2 | Среднее | 🟡 Среднее |
| AND-17 | Biometric auth | P2 | Среднее | 🟡 Среднее |
| AND-18 | Scoped Storage / API 34 | P2 | Среднее | 🟠 Высокое |
| AND-19 | Widget | P3 | Высокое | 🟢 Низкое |
| AND-20 | App Shortcuts | P3 | Низкое | 🟢 Низкое |
| AND-21 | PiP для карты | P3 | Высокое | 🟢 Низкое |
| AND-22 | GPS tracking | P3 | Высокое | 🟡 Среднее |
| AND-23 | Share integration | P3 | Среднее | 🟡 Среднее |
| AND-24 | Dark theme native sync | P3 | Низкое | 🟢 Низкое |
| AND-25 | Performance monitoring | P3 | Среднее | 🟡 Среднее |
| AND-26 | TalkBack audit | P3 | Среднее | 🟡 Среднее |
| AND-27 | Material Design 3 | P2 | Высокое | 🟡 Среднее |
| AND-28 | Edge-to-edge | P2 | Среднее | 🟠 Высокое |
| ~~AND-29~~ | ✅ versionCode sync | ~~P1~~ | Низкое | 🟠 Среднее |
| AND-30 | Hermes optimization | P2 | Низкое | 🟡 Среднее |
| AND-31 | APK size optimization | P2 | Среднее | 🟡 Среднее |
| ~~AND-32~~ | ✅ Secure storage audit | ~~P1~~ | Низкое | 🔴 Высокое |
| ~~AND-33~~ | ✅ Network security config | ~~P2~~ | Низкое | 🟠 Среднее |

---

## 9. 📅 Рекомендуемый план спринтов

### 🔥 Спринт 1 (1 неделя) — Критические P0 + быстрые P1

| # | Задача | Описание |
|---|--------|----------|
| 1 | AND-02 | Исправить package name в build.gradle |
| 2 | AND-04 | Вычистить permissions |
| 3 | AND-01 | Проверить и настроить App Links |
| 4 | AND-29 | Синхронизировать versionCode |
| 5 | AND-08 | StatusBar глобальная настройка |
| 6 | AND-32 | Аудит secure storage |

### 🟠 Спринт 2 (1–2 недели) — Core Android UX

| # | Задача | Описание |
|---|--------|----------|
| 1 | AND-03 | Google Sign-In native |
| 2 | AND-07 | BackHandler на всех экранах |
| 3 | AND-06 | Splash screen с dark mode support |
| 4 | AND-09 | Keyboard handling |
| 5 | AND-11 | Proguard/R8 |
| 6 | AND-27 | Ripple effects + android_ripple |

### 🟡 Спринт 3 (2 недели) — Push & Offline

| # | Задача | Описание |
|---|--------|----------|
| 1 | AND-05 | Push-уведомления (FCM) |
| 2 | AND-10 | Offline mode базовый |
| 3 | AND-14 | Pull-to-Refresh расширение |
| 4 | AND-18 | Scoped Storage / targetSdk 34 |

### 🟢 Спринт 4 (2 недели) — Polish & Features

| # | Задача | Описание |
|---|--------|----------|
| 1 | AND-12 | Monochrome icon для Material You |
| 2 | AND-13 | Haptic feedback расширение |
| 3 | AND-15 | Image Picker с crop/compress |
| 4 | AND-16 | Native animations (bottom sheet, transitions) |
| 5 | AND-17 | Biometric authentication |
| 6 | AND-28 | Edge-to-edge display |

### 🟣 Спринт 5 (2 недели) — Advanced

| # | Задача | Описание |
|---|--------|----------|
| 1 | AND-23 | Share integration |
| 2 | AND-25 | Performance monitoring |
| 3 | AND-26 | TalkBack audit |
| 4 | AND-31 | APK size optimization |
| 5 | AND-33 | Network security config |

---

## 10. Критерии готовности (Definition of Done)

Для каждого Android-изменения:
- [ ] Протестировано на реальном Android устройстве (не только эмулятор)
- [ ] Работает на Android 10+ (API 29+)
- [ ] Не ломает iOS сборку
- [ ] Не ломает web сборку
- [ ] `npm run lint` — 0 ошибок
- [ ] `npm run test:run` — все тесты проходят
- [ ] Проверено в светлой и тёмной теме
- [ ] `accessibilityLabel` задан для интерактивных элементов
- [ ] Touch target ≥ 48dp для всех кнопок
- [ ] Используются `DESIGN_TOKENS` — без hardcoded цветов
- [ ] Production build (AAB) собирается без ошибок

---

## 11. Связь с существующими документами

| Документ | Связь |
|----------|-------|
| `docs/UX_UI_AUDIT.md` | Все задачи закрыты — этот документ продолжает работу для Android native |
| `docs/PERFORMANCE_IMPROVEMENT_PLAN.md` | Web-оптимизации выполнены — AND-11, AND-30, AND-31 адресуют native performance |
| `docs/RULES.md` | Все правила UI/компонентов применимы к Android-разработке |
| `docs/ADR_STATE_MANAGEMENT.md` | State management правила те же: Zustand + React Query |
| `docs/GOOGLE_OAUTH_SETUP.md` | AND-03 расширяет OAuth на native Android |
| `ANDROID-README.md` | Build/deploy инструкции для Android |

---

*Документ создан на основе анализа кодовой базы metravel2 с позиции Android-инженера.  
Обновлять при выполнении задач — отмечать ~~зачёркиванием~~ завершённые.*

---

## 12. История обновлений

### Март 2026 — Сессия 1

**Реализовано (Спринт 1 + частично Спринт 2):**

- ~~AND-02~~ (P0) — Package name: `build.gradle` namespace/applicationId исправлены с `com.yourcompany.metravel` на `by.metravel.app`. `AndroidManifest.xml` scheme тоже исправлен
- ~~AND-04~~ (P0) — Permissions cleanup: из `app.json` и `AndroidManifest.xml` удалены `ACCESS_BACKGROUND_LOCATION`, `READ_EXTERNAL_STORAGE`, `WRITE_EXTERNAL_STORAGE`, дублирующиеся full-qualified permissions, `requestLegacyExternalStorage`
- AND-01 (P0, частично) — App Links: создан `public/.well-known/assetlinks.json` (шаблон). Требуется замена SHA-256 fingerprint из release keystore
- ~~AND-29~~ (P1) — versionCode sync: `build.gradle` versionCode=2, versionName="1.0.0" синхронизированы с `app.json`
- ~~AND-08~~ (P1) — StatusBar: глобальный `<StatusBar style="auto" />` из `expo-status-bar` добавлен в `_layout.tsx`
- ~~AND-32~~ (P1) — Secure storage audit: подтверждено что auth token хранится через `setSecureItem` → `expo-secure-store` на native. `allowBackup="false"` установлен
- ~~AND-07~~ (P1) — BackHandler: создан хук `useAndroidBackHandler` с double-tap exit на home, `onDismiss` callback. Подключён в BottomDock
- ~~AND-06~~ (P1) — Splash Screen: `SplashScreen.hideAsync()` перемещён в `RootLayoutNav` после загрузки шрифтов. Android dark splash конфигурация добавлена
- ~~AND-11~~ (P1) — Proguard/R8: включён (`enableProguardInReleaseBuilds = true`). ProGuard rules расширены для Hermes, Expo, gesture-handler, safe-area-context, OkHttp
- ~~AND-33~~ (P2) — Network security config: создан `network_security_config.xml` (HTTPS only, исключения для dev). Подключён в `AndroidManifest.xml`
- AND-27 (P2, частично) — Material Design 3: `android_ripple` добавлен на BottomDock кнопки и UnifiedTravelCard
- AND-13 (P2, частично) — Haptic feedback: `hapticSelection()` добавлен в BottomDock при нажатии на tab

**Тесты:** 463 suite, 4031 test — все прошли. Lint: 0 ошибок.

**Оставшиеся нереализованные задачи P0–P1:**
- AND-01 (P0) — App Links: нужна замена SHA-256 и серверная верификация
- AND-03 (P0) — Google Sign-In native: требует настройки Google Cloud Console + native SDK
- AND-05 (P1) — Push-уведомления: требует FCM + бэкенд
- AND-10 (P1, частично) — Offline mode: `networkMode: 'offlineFirst'` добавлен, NetworkStatus баннер есть — осталось кэширование маршрутов через AsyncStorage

### Март 2026 — Сессия 2

**Реализовано (Спринт 2 + Спринт 3):**

- ~~AND-09~~ (P1) — Keyboard handling:
  - Создан компонент `KeyboardAwareContainer` (`components/ui/KeyboardAwareContainer.tsx`) — кроссплатформенная обёртка с правильными offsets
  - Android: `behavior="height"` (вместо `undefined`) во всех 6 Travel Wizard шагах (Basic, Extras, Media, Route, Details, Publish) и ChatView
  - iOS: `behavior="padding"` сохранён
  - `android.softwareKeyboardLayoutMode: "resize"` добавлен в `app.json`
  - Web: KeyboardAvoidingView не рендерится (не нужен)

- AND-10 (P1, частично) — Offline mode:
  - React Query `networkMode: 'offlineFirst'` добавлен в `utils/reactQueryConfig.ts` — запросы используют кэш при отсутствии сети
  - `NetworkStatus` компонент уже подключён глобально (persistent баннер)
  - `refetchOnReconnect: true` уже включён

- ~~AND-14~~ (P2) — Pull-to-Refresh расширение:
  - `RefreshControl` добавлен на главную страницу (`Home.tsx`) — `queryClient.invalidateQueries()` при pull-to-refresh
  - `refreshing`/`onRefresh` добавлены в профиль (`profile.tsx`) — обновление через `loadTravels` + `loadUserInfo`
  - `refreshing`/`onRefresh` добавлены в избранное (`favorites.tsx`) — FlashList native pull-to-refresh
  - `refreshing`/`onRefresh` добавлены в историю (`history.tsx`) — FlashList native pull-to-refresh

**Тесты:** 463 suite, 4031 test — все прошли. Lint: 0 ошибок.

### Март 2026 — Сессия 3

**Реализовано (Спринт 3 + Спринт 4):**

- AND-13 (P2, расширение) — Haptic feedback:
  - Установлен `expo-haptics` (`npx expo install expo-haptics`)
  - `hapticImpact('light')` добавлен при pull-to-refresh на главной (`Home.tsx`) и профиле (`profile.tsx`)
  - Добавлен mock `expo-haptics` в `__tests__/setup.ts` для тестовой среды (no-op)
  - Вся haptic-логика уже была в `utils/haptics.ts` — теперь работает реально на native

- AND-27 (P2, расширение) — Material Design 3:
  - `android_ripple` добавлен на `Button` (`components/ui/Button.tsx`) — `{ color: 'rgba(0,0,0,0.12)', borderless: false }`
  - `android_ripple` добавлен на `IconButton` (`components/ui/IconButton.tsx`) — оба варианта (labeled и icon-only)
  - Создан компонент `FloatingActionButton` (`components/ui/FloatingActionButton.tsx`) — M3 FAB (56×56dp, borderRadius 16, elevation 6)
  - FAB «Создать маршрут» добавлен на страницу поиска (`search.tsx`) для авторизованных пользователей (native only)
  - FAB использует `hapticImpact('medium')` при нажатии

- AND-28 (P2, частично) — Edge-to-edge display:
  - Установлен `expo-navigation-bar` (`npx expo install expo-navigation-bar`)
  - Добавлен `useEffect` в `ThemedContent` (`_layout.tsx`) — синхронизация цвета Android navigation bar с текущей темой
  - `NavigationBar.setBackgroundColorAsync(colors.background)` + `setButtonStyleAsync('light'/'dark')`
  - Динамический require — не ломает web/iOS

**Тесты:** 463 suite — все прошли. Lint: 0 ошибок.

**Оставшиеся нереализованные задачи P0–P1:**
- AND-01 (P0) — App Links: нужна замена SHA-256 и серверная верификация
- AND-03 (P0) — Google Sign-In native: требует настройки Google Cloud Console + native SDK
- AND-05 (P1) — Push-уведомления: требует FCM + бэкенд
- AND-10 (P1, частично) — Offline mode: осталось кэширование маршрутов через AsyncStorage
