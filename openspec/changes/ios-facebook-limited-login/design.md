## Context

См. `proposal.md` — Why. Текущее состояние кода:

- Общий flow входа `components/auth/FacebookAuthFlow.shared.tsx` получает от кнопки `FacebookCredential { accessToken, grantedScopes, emailPermissionGranted }` и вызывает `loginWithFacebook(credential.accessToken)` → `api/auth.ts:facebookAuthApi` → `POST /user/facebook-login/` с телом `{ access_token }`; сценарий дополнения email (`/complete/start`, `/complete/confirm`) общий для всех платформ.
- Native-кнопка `components/auth/FacebookSignInButton.native.tsx` вызывает `LoginManager.logInWithPermissions(perms)` (классический режим) и читает `AccessToken.getCurrentAccessToken()`; на iOS её перекрывает заглушка `FacebookSignInButton.ios.tsx` (#1895).
- `react-native-fbsdk-next` 13.4.3 уже умеет Limited Login: `logInWithPermissions(perms, 'limited', nonce)` и `AuthenticationToken.getAuthenticationTokenIOS()` → `{ authenticationToken, nonce, graphDomain }`.
- iOS-сборка: SDK исключён через `package.json` → `expo.autolinking.ios.exclude`; `ios/**` канонический, prebuild для iOS не запускается, Info.plist правится руками; гейты `scripts/ios-release-guard-lib.js` (`IOS_META_SDK_LINKED`) и `scripts/ios-artifact-audit-lib.js` (`IOS_ARTIFACT_META_SDK`, `IOS_ARTIFACT_SDK_TRACKING`) сейчас запрещают Meta SDK.
- Бэкенд (`../metravel-backend`, read-only): `users/services/facebook_login_service.py` — `verify_profile(access_token)` через Graph `debug_token` + `/me`, затем `authenticate` → линковка/создание/completion; `users/serializers.py:FacebookLoginSerializer` принимает только `access_token`; настройки `FACEBOOK_LOGIN_APP_ID`/`FACEBOOK_LOGIN_APP_SECRET`.
- Ограничения: App Privacy `tracking=false`, ATT не добавляем; `.env` до облачной сборки EAS не доходит — флаги только через EAS environment variables.

## Goals / Non-Goals

**Goals:**
- Один общий flow входа для всех платформ: кнопка отдаёт credential, тип которого определяет тело запроса; логика completion/линковки не дублируется.
- Meta SDK на iOS — только в конфигурации без трекинга, и это состояние держат гейты, а не договорённость.
- Web и Android не трогаются ни в коде запроса, ни в поведении.

**Non-Goals:**
- Верификация JWT на клиенте (только сервер).
- Поддержка `graphDomain` ≠ `facebook` (Gaming) — не требуется.
- Общий рефактор `FacebookSignInButton.native.tsx` под Android.

## Decisions

1. **Credential как размеченное объединение, а не второе поле.** `FacebookCredential` становится `{ kind: 'access_token', accessToken, ... } | { kind: 'authentication_token', authenticationToken, nonce, ... }`; `facebookAuthApi(credential)` строит тело `{ access_token }` или `{ authentication_token, nonce }`. Альтернатива — два опциональных поля в одном объекте — отвергнута: допускает одновременно оба или ни одного, а бэкенд такой запрос отклоняет; тип должен это исключать на этапе компиляции. Совместимость: web-кнопка и Android-ветка продолжают отдавать `kind: 'access_token'`.
2. **Ветвление по платформе внутри `FacebookSignInButton.native.tsx`, а не третий файл.** На `Platform.OS === 'ios'` вызывается `logInWithPermissions(perms, 'limited', nonce)` и читается `AuthenticationToken.getAuthenticationTokenIOS()`; на Android — прежний путь. Заглушка `FacebookSignInButton.ios.tsx` удаляется. Альтернатива — отдельный `.ios.tsx` с полной копией кнопки — отвергнута как дубль 200 строк UI ради одного вызова.
3. **Nonce генерируется на клиенте на каждую попытку** (`expo-crypto` уже в зависимостях: `randomUUID`/`getRandomBytesAsync`) и отправляется серверу вместе с токеном; сервер сравнивает с claim `nonce`. SDK принимает сырой nonce и сам хеширует его в claim по правилам Meta — уточняется по документации Meta на этапе реализации: если claim содержит SHA-256 от nonce, сервер сравнивает хеш. Это открытый вопрос реализации, не спецификации: контракт «nonce запроса должен соответствовать claim» неизменен.
4. **Возврат SDK — откат механики #1895, а не ручная правка pbxproj.** Снять `expo.autolinking.ios.exclude`, `pod install` без `--repo-update` (память проекта: `--repo-update` выкидывает `ReactNativeDependencies.framework`), восстановить в Info.plist блок ключей из `git show e17db1872^:ios/metravel/Info.plist`, но с `FacebookAutoInitEnabled=false` (инициализацию делает кнопка через `Settings.initializeSDK()` при монтировании, как на Android; `FacebookAppDelegate`-подписчик всё равно форвардит `didFinishLaunching`, поэтому ключ фиксирует намерение и проверяется гейтом). `AutoLogAppEvents=false`, `AdvertiserIDCollection=false` сохраняются.
5. **Гейты переворачиваются, а не удаляются.** `ios-release-guard`: `IOS_META_SDK_LINKED` → `IOS_META_SDK_CONFIG`: SDK обязан быть залинкован (Podfile.lock содержит `react-native-fbsdk-next`, `ExpoAdapterFBSDKNext`), Info.plist обязан содержать `FacebookAppID`, `FacebookClientToken`, `FacebookDisplayName`, схему `fb<AppID>`, `LSApplicationQueriesSchemes` c fb-схемами, `FacebookAutoLogAppEventsEnabled=false`, `FacebookAdvertiserIDCollectionEnabled=false`, `FacebookAutoInitEnabled=false`; исходник `FacebookSignInButton.native.tsx` обязан содержать вызов с `'limited'` в iOS-ветке и не содержать `'enabled'`; файла `FacebookSignInButton.ios.tsx` быть не должно. `ios-artifact-audit`: `IOS_ARTIFACT_META_SDK` снимается; `IOS_ARTIFACT_SDK_TRACKING` допускает `NSPrivacyTracking=true`/tracking domains только у бандлов с именами `FBSDK*`/`FBAEMKit*` и только когда compiled Info.plist несёт оба `=false` флага; любой другой манифест с трекингом — ошибка. Так контракт «мы не трекаем» остаётся машинно проверяемым.
6. **Бэкенд — отдельная `area=back` карточка, отсюда не правится.** Предлагаемый дизайн для владельца бэка: `FacebookLoginSerializer` с `access_token` XOR (`authentication_token` + `nonce`); `FacebookLoginService.verify_oidc_token(token, nonce)` — JWKS `https://www.facebook.com/.well-known/oauth/openid-connect/` с кэшем ключей по `kid` (TTL ~сутки, повторная загрузка при неизвестном `kid`), проверка RS256, `iss`, `aud=FACEBOOK_LOGIN_APP_ID`, `exp`, `nonce`; результат приводится к той же структуре профиля, что `verify_profile` (`id=sub`, `email`, `name`, `picture`), дальше общий `authenticate`. Ошибки маппятся на существующие коды (`facebook_token_invalid`, `facebook_service_unavailable`). Библиотека JWT — на усмотрение владельца бэка (`PyJWT` с `PyJWKClient` — ближайший стандарт).

## Affected frontend paths

`package.json`, `ios/Podfile.lock`, `ios/metravel.xcodeproj/project.pbxproj`, `ios/metravel/Info.plist`, `components/auth/facebookLoginTypes.ts`, `components/auth/FacebookSignInButton.native.tsx`, `components/auth/FacebookSignInButton.web.tsx` (только `kind`), удаление `components/auth/FacebookSignInButton.ios.tsx`, `components/auth/FacebookAuthFlow.shared.tsx`, `api/auth.ts`, `scripts/ios-release-guard-lib.js`, `scripts/ios-artifact-audit-lib.js`, тесты `__tests__/components/auth/FacebookSignInButton.native.test.tsx`, `__tests__/components/auth/FacebookSignInButton.web*.test.*`, `__tests__/api/auth*.test.ts` (или новый), `__tests__/config/ios-release-config.test.ts`, `__tests__/config/ios-artifact-audit.test.ts`, `__tests__/setup.ts` (мок `AuthenticationToken`), документы `docs/features/auth.md`, `docs/IOS_APP_REVIEW_RESPONSE_20260910.md`, `docs/IOS_APP_REVIEW_GUIDE.md`.

## Data/API contract

`POST /user/facebook-login/`, тело: `{ "access_token": string }` **или** `{ "authentication_token": string, "nonce": string }`. Ответы и коды ошибок — прежние (`200` сессия; `400 access_token_required` → расширяется смыслом «credential отсутствует», код сохраняется ради совместимости клиентов; `401 facebook_token_invalid`; `409 facebook_email_completion_required` / `facebook_account_conflict`; `503 facebook_not_configured` / `facebook_service_unavailable`). Endpoints completion не меняются.

## Risks / Trade-offs

- [Apple 5.1.2: SDK-манифесты Meta объявляют трекинг при App Privacy `tracking=false`] → Limited Login — официальный режим Meta для приложений без ATT; tracking-домены iOS блокирует сам без разрешения; в Reply/Notes для ревью фиксируется: App Events и Advertiser ID выключены, режим Limited Login, ATT не запрашивается. Остаточный риск — запрос Apple на пояснение; отвечаем документами.
- [Nonce: SDK хеширует или нет] → закрывается unit-пробой на реальном токене на стадии testing; сервер реализует сравнение по документации Meta (сырой nonce → SHA-256 в claim, если так задокументировано).
- [Бэкенд не задеплоен, а фронт уже в сторе] → флаг `EXPO_PUBLIC_FACEBOOK_LOGIN_ENABLED` в EAS остаётся `false` до деплоя бэка; кнопка не показывается.
- [Возврат SDK ломает симуляторный smoke] → повторить локальную Release-сборку под симулятор, как в #1895.
- [`pod install --repo-update` через `expo run:ios`] → только plain `pod install`, рецепт в памяти проекта.

## Migration Plan

1. Backend (area=back) реализует и деплоит приём `authentication_token`; проверка — `curl` с реальным токеном из TestFlight-сессии владельца или unit-тестами на подписанном тестовом JWT.
2. Frontend: возврат SDK + Limited Login + гейты + тесты; коммит в `main`; флаг в EAS остаётся выключенным до п. 1.
3. Владелец: Meta iOS-платформа, EAS-переменные, App Privacy.
4. Следующий подписанный кандидат (отдельное разрешение) — TestFlight-проверка живого входа на физическом iPhone.
Откат: вернуть `expo.autolinking.ios.exclude`, `pod install`, восстановить состояние #1895 (`git revert` фронтовых коммитов); бэкенд-контракт обратно совместим и откату не мешает.

## Validation matrix

| Поверхность | Проверка |
| --- | --- |
| iOS (unit) | RNTL: кнопка на iOS вызывает `'limited'` + nonce, отдаёт `kind: 'authentication_token'`; `facebookAuthApi` шлёт `authentication_token`/`nonce`; отмена/ошибка/нет email |
| iOS (config) | `npm run ios:release:guard` зелёный на новой конфигурации, красный на `'enabled'`/AutoLogAppEvents=true; `ios:artifact:audit` на локальной симуляторной Release-сборке — Meta-бандлы допущены, посторонний tracking-манифест красный |
| iOS (device, стадия testing) | Физический iPhone / TestFlight: живой вход, отмена, аккаунт без email → completion; ATT-диалог не появляется (Settings → Privacy → Tracking: приложения нет в списке) |
| Android | `FacebookSignInButton.native.test.tsx` — Android-ветка шлёт access token; регресс на устройстве не требуется (код ветки не менялся) |
| Web | `FacebookSignInButton.web*.test` + `FacebookAuthFlow.web.test` зелёные; смок формы входа в браузере не требуется (тело запроса web не изменилось) |
| Локали | `npm run test:i18n` (ключи не добавлялись) |
| Backend (area=back) | pytest: обе формы credential, все сценарии ошибок, JWKS-кэш; прод-проба после деплоя |

SEO, performance-бюджет страниц, analytics — не применимы (экран входа приложения, событий нет). Accessibility — существующая кнопка, изменений нет. Security — см. Decisions 3, 5, 6.
