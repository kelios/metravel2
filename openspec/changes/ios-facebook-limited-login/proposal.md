## Why

**Problem.** Вход через Facebook есть на сайте (desktop и mobile web) и в Android-приложении, а в iPhone-приложении его нет: кнопку спрятали в #1503, а #1895 (коммит `e17db1872`) вовсе исключил Meta SDK из iOS-сборки, потому что privacy manifest SDK объявляет `tracking=true`, а форма App Privacy и собственный манифест приложения — `tracking=false`. Пользователь, зарегистрированный через Facebook на сайте, в iPhone-приложение может войти только по email и паролю, которого у него, как правило, нет.

**Goal.** Владелец 13.09.2026 решил: на iPhone вход через Facebook должен быть. Целевое состояние — на экране входа iPhone-приложения есть кнопка Facebook, вход через неё завершается той же сессией MeTravel, что на web/Android, при этом приложение не запрашивает App Tracking Transparency, а форма App Privacy остаётся `tracking=false`.

## What Changes

- iPhone-приложение выполняет вход через Facebook в режиме Meta **Limited Login**: результат — OIDC-токен (JWT) и nonce, а не access token Graph API; ATT-запрос не добавляется.
- Meta SDK возвращается в iOS-сборку в конфигурации Limited Login: автологирование событий и сбор advertiser ID выключены; кнопка входа на iOS перестаёт быть заглушкой.
- **BREAKING (backend contract, area=back):** `POST /user/facebook-login/` принимает второй тип credential — `authentication_token` + `nonce` — и проверяет его как OIDC JWT Meta; существующий `access_token` продолжает работать без изменений для web и Android.
- Гейты iOS-релиза меняют контракт с «Meta SDK запрещён» на «Meta SDK разрешён только в конфигурации Limited Login без трекинга».
- Документы App Review (`docs/IOS_APP_REVIEW_RESPONSE_20260910.md`, `docs/IOS_APP_REVIEW_GUIDE.md`, `docs/features/auth.md`) описывают новое состояние; форму App Privacy владелец подтверждает как `tracking=false`.

### User-visible result

На iPhone на экранах входа и регистрации появляется кнопка «Войти через Facebook» рядом с Apple и Google. Нажатие открывает системный Facebook-диалог, после согласия пользователь авторизован в MeTravel; если Facebook не отдал email, срабатывает тот же сценарий «дополнить email», что на web/Android. Web и Android внешне не меняются.

### Platform impact

`iOS` (приложение) и backend. Desktop web, mobile web и Android — без изменений поведения; они продолжают слать `access_token`.

### Localization impact

`none` — используются существующие ключи `authStatic:facebook.*` на всех пяти локалях; новых строк UI не появляется.

### Dependencies

- **Backend (area=back, `../metravel-backend`, здесь read-only):** верификация OIDC JWT Meta по JWKS и приём `authentication_token`/`nonce` в `POST /user/facebook-login/`. Точный blocker: до деплоя бэкенда iOS-вход даёт `facebook_token_invalid`/`400`.
- **Владелец, Meta for Developers:** платформа iOS с bundle ID `by.metravel.app` у приложения `2443100196153960`, Facebook Login включён, приложение в режиме Live.
- **Владелец, EAS environment variables (production и preview):** `EXPO_PUBLIC_FACEBOOK_LOGIN_ENABLED=true`, `EXPO_PUBLIC_META_APP_ID`, `META_FACEBOOK_CLIENT_TOKEN` — iOS собирается в облаке EAS, локальный `.env` туда не попадает.
- **Владелец, App Store Connect:** подтверждение формы App Privacy (`tracking=false`) и решение по следующему подписанному кандидату.

### Fallback/mock policy

Fallback недопустим: без деплоенного backend-контракта iOS-вход не «эмулируется» и не подменяется access-token-путём (на iOS access token в Limited Login недоступен). Моки допустимы только в unit-тестах (SDK, fetch). Пока backend не задеплоен, кнопка на iOS остаётся выключенной флагом `EXPO_PUBLIC_FACEBOOK_LOGIN_ENABLED` в EAS — это существующий конфигурационный гейт, а не заглушка.

### Impact summary

- **Data/API:** новый вариант тела запроса `POST /user/facebook-login/` (`authentication_token`, `nonce`); ответ и коды ошибок прежние. Данных профиля берётся не больше, чем сейчас (`sub`, `email`, `name`, `picture`).
- **SEO:** не применимо — экран входа приложения, не публичная страница.
- **Accessibility:** кнопка уже соответствует контракту social-кнопок (44dp, `accessibilityLabel`); новых элементов нет.
- **Performance:** в iOS-бандл возвращаются шесть фреймворков Meta (как было в build 9); на web/Android размер не меняется.
- **Security:** проверка JWT (подпись RS256 по JWKS Meta, `iss`, `aud`, `exp`, `nonce`) на бэкенде; nonce генерируется клиентом на каждую попытку; токены не логируются; App Tracking не включается, `AutoLogAppEvents=false`, `AdvertiserIDCollection=false`.
- **Analytics:** событий не добавляется; Meta AEM/App Events остаются выключенными.

### Existing behavior to preserve

- Web-вход через Facebook (JS SDK, `access_token`) и Android-вход (native SDK, `access_token`) работают как сейчас, включая сценарий дополнения email и линковку с существующим аккаунтом.
- Apple- и Google-вход на iOS не меняются.
- Остальные гейты iOS-релиза (privacy manifest приложения, purpose strings, entitlements) остаются в силе.

### Out of scope / Non-goals

- ATT-запрос и классический (tracking-enabled) Facebook Login на iOS.
- Facebook Share, App Events, deep links Meta, Login Button UI Meta.
- Изменения на web и Android.
- Подписанная сборка, TestFlight, submit и storefront release — отдельные разрешения владельца.
- Слияние аккаунтов сверх текущей логики бэкенда.

### Open questions

- Нет вопросов, меняющих scope. Уточнение, которое можно закрыть по ходу: сохраняет ли Limited Login `picture` в claims для всех аккаунтов — бэкенд обязан переживать отсутствие `picture` и `email`.

## Capabilities

### New Capabilities
- `facebook-login-ios`: вход через Facebook в iPhone-приложении в режиме Limited Login без App Tracking Transparency, включая конфигурацию SDK и релизные гейты.
- `facebook-login-token-contract`: контракт `POST /user/facebook-login/` — приём и проверка OIDC `authentication_token` наряду с `access_token`.

### Modified Capabilities
- (нет — главных спецификаций в `openspec/specs/` ещё не существует; обе capability новые)

## Impact

- Frontend: `package.json` (`expo.autolinking.ios.exclude`), `ios/Podfile.lock`, `ios/metravel.xcodeproj/project.pbxproj`, `ios/metravel/Info.plist`, `components/auth/FacebookSignInButton.native.tsx`, удаление `components/auth/FacebookSignInButton.ios.tsx`, `components/auth/facebookLoginTypes.ts`, `components/auth/FacebookAuthFlow.shared.tsx`, `api/auth.ts`, `scripts/ios-release-guard-lib.js`, `scripts/ios-artifact-audit-lib.js`, тесты `__tests__/components/auth/*`, `__tests__/config/ios-*`, `__tests__/api/*`, документы `docs/features/auth.md`, `docs/IOS_APP_REVIEW_RESPONSE_20260910.md`, `docs/IOS_APP_REVIEW_GUIDE.md`.
- Backend (read-only отсюда, area=back): `users/services/facebook_login_service.py`, `users/serializers.py`, `users/views.py`, тесты `tests/users/`.
- Внешние системы: Meta for Developers, EAS environment variables, App Store Connect (App Privacy).
- Борд: связанные карточки #1895 (исключение SDK — временное состояние), #1503.
