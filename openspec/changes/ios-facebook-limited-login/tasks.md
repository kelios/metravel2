## 1. Предпосылки (владелец и бэкенд, вне этого workspace)

- [ ] 1.1 Владелец: в Meta for Developers у приложения 2443100196153960 добавлена платформа iOS с bundle ID `by.metravel.app`, Facebook Login включён, приложение в режиме Live (human-карточка на борде)
- [ ] 1.2 Владелец: в EAS environment variables (production, preview) заведены `EXPO_PUBLIC_FACEBOOK_LOGIN_ENABLED`, `EXPO_PUBLIC_META_APP_ID`, `META_FACEBOOK_CLIENT_TOKEN`; флаг остаётся `false` до деплоя бэкенда
- [ ] 1.3 Backend (area=back): `POST /user/facebook-login/` принимает `authentication_token`+`nonce`, верифицирует OIDC JWT по JWKS Meta, маппит `sub/email/name/picture` в общий путь `authenticate`; pytest на все сценарии спеки `facebook-login-token-contract`; деплой и запись SHA в карточке

## 2. Возврат Meta SDK в iOS-сборку в конфигурации без трекинга

- [x] 2.1 Снять `react-native-fbsdk-next` из `package.json` → `expo.autolinking.ios.exclude`; проверить `expo-modules-autolinking react-native-config --platform ios` — пакет резолвится
- [x] 2.2 `LANG=en_US.UTF-8 pod install` в `ios/` (без `--repo-update`); diff `Podfile.lock`/`project.pbxproj` — только возврат FBSDK*/FBAEMKit, `ReactNativeDependencies.framework` на месте
- [x] 2.3 Восстановить в `ios/metravel/Info.plist` `FacebookAppID`, `FacebookClientToken`, `FacebookDisplayName`, URL-схему `fb<AppID>`, `LSApplicationQueriesSchemes` (fbapi, fb-messenger-api, fbauth2, fbshareextension); выставить `FacebookAutoInitEnabled=false`, сохранить `FacebookAutoLogAppEventsEnabled=false`, `FacebookAdvertiserIDCollectionEnabled=false`; `plutil -lint`
- [x] 2.4 Удалить `components/auth/FacebookSignInButton.ios.tsx`

## 3. Limited Login в общем flow входа

- [x] 3.1 `components/auth/facebookLoginTypes.ts`: `FacebookCredential` как размеченное объединение `kind: 'access_token' | 'authentication_token'` (spec `facebook-login-ios` → Requirement «iPhone uses Limited Login»)
- [x] 3.2 `components/auth/FacebookSignInButton.native.tsx`: iOS-ветка — nonce на каждую попытку (источник энтропии — нативный `expo-crypto` `getRandomValues`: Hermes на устройстве Web Crypto не реализует, ни `react-native`, ни winter-runtime `expo` не ставят `globalThis.crypto`, поэтому опора только на него оставляла кнопку на iPhone мёртвой при зелёном jest; `expo-crypto` объявлен прямой зависимостью, под ExpoCrypto уже в `ios/Podfile.lock`, модуль автолинкуется на Android; Web Crypto используется там, где он есть, нулевой буфер считается отказом источника и попытка не начинается), `logInWithPermissions(perms, 'limited', nonce)`, `AuthenticationToken.getAuthenticationTokenIOS()`, credential `kind: 'authentication_token'`; отмена → `onCancel`, отсутствие токена → `onError`; Android-ветка без изменений
- [x] 3.3 `components/auth/FacebookSignInButton.web.tsx`: отдавать `kind: 'access_token'` (только тип, поведение прежнее)
- [x] 3.4 `components/auth/FacebookAuthFlow.shared.tsx` и `api/auth.ts:facebookAuthApi`: принимать credential целиком, тело запроса `{access_token}` или `{authentication_token, nonce}`; ошибки и completion — прежние
- [x] 3.5 Тесты: `__tests__/setup.ts` мок `AuthenticationToken`; `FacebookSignInButton.native.test.tsx` — сценарии iOS (limited + nonce, отмена, нет токена, повторный запрос email) и Android (access token) через подмену `Platform.OS`; тест `facebookAuthApi` на оба тела запроса; web-тесты зелёные

## 4. Гейты релиза и артефакта

- [x] 4.1 `scripts/ios-release-guard-lib.js`: заменить `IOS_META_SDK_LINKED` на `IOS_META_SDK_CONFIG` по design.md → Decisions 5 (SDK залинкован, ключи Info.plist, три `=false` флага, `'limited'` в iOS-ветке, отсутствие заглушки `.ios.tsx`); экспортировать константы для audit
- [x] 4.2 `scripts/ios-artifact-audit-lib.js`: снять `IOS_ARTIFACT_META_SDK`; `IOS_ARTIFACT_SDK_TRACKING` допускает трекинг только у `FBSDK*`/`FBAEMKit*` при обоих `=false` в compiled Info.plist
- [x] 4.3 Тесты `__tests__/config/ios-release-config.test.ts` и `ios-artifact-audit.test.ts`: позитив на новую конфигурацию, негатив на `'enabled'`, `AutoLogAppEvents=true`, посторонний tracking-манифест; `node scripts/ios-release-guard.js` зелёный на реальном репо
- [x] 4.4 Локальная Release-сборка под iOS-симулятор (`xcodebuild -configuration Release -sdk iphonesimulator`), `validateIosAppBundle(.app)` — только `IOS_ARTIFACT_PROVISIONING`. Запуск приложения на симуляторе — стадия `testing` (implementation/review симулятор не поднимают)

## 5. Документы

- [x] 5.1 `docs/features/auth.md`: матрица провайдеров (iPhone: да, Limited Login) и абзац про режим без ATT
- [x] 5.2 `docs/IOS_APP_REVIEW_RESPONSE_20260910.md` раздел 4 и `docs/IOS_APP_REVIEW_GUIDE.md`: состояние следующего кандидата — Meta SDK в режиме Limited Login, App Events/Advertiser ID выключены, ATT не запрашивается
- [x] 5.3 Карточки борда: #1895 помечена как временное состояние, новые карточки связаны (без смены статусов сверх разрешённого)

## 6. Code review и статические проверки

- [ ] 6.1 `review-auditor` review-and-fix по полному diff задачи; `code-review-gate` перед `testing`
- [x] 6.2 `npx tsc --noEmit`, eslint на изменённых файлах, `npm run test:i18n`, jest-наборы auth/config/api, `npm run ios:release:guard`

## 7. Testing (после review, отдельная стадия)

- [ ] 7.1 Backend задеплоен (п. 1.3): `curl -X POST /user/facebook-login/` с невалидным `authentication_token` → `401 facebook_token_invalid`; без credential → `400`
- [ ] 7.2 Физический iPhone / TestFlight следующего кандидата (отдельное разрешение владельца на сборку и загрузку): живой вход через Facebook, отмена диалога, аккаунт без email → сценарий дополнения; ATT-диалог отсутствует, в Settings → Privacy → Tracking приложения нет
- [ ] 7.3 Android: вход через Facebook на устройстве работает как раньше (регресс общей кнопки)
- [ ] 7.4 Web: `E2E_SUITE=smoke` или ручной смок формы входа — кнопка Facebook на месте, запрос уходит с `access_token`

## 8. Завершение

- [ ] 8.1 `openspec validate ios-facebook-limited-login --strict` и `openspec validate --all` перед archive
