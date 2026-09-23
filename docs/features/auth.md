# Фича: auth (вход и регистрация)

**Последняя актуализация:** 2026-09-23

## TL;DR

Вход в MeTravel: email + пароль и три соц-провайдера. Провайдер, выпущенный
только на одной поверхности, создаёт аккаунты, которые на остальных поверхностях
войти не могут — именно это случилось с Apple (#1506) и потому эта матрица
здесь, а не в чьей-то голове.

## Точки входа

| Путь | Назначение |
|------|-----------|
| `/login` | вход (`components/auth/LoginForm.tsx`) |
| `/registration` | регистрация (`components/auth/RegistrationForm.tsx`) |
| `/set-password` | установка пароля по токену из письма (`SetPasswordForm.tsx`) |

## Матрица «провайдер × поверхность»

Единственный источник правды по паритету. `гейт` означает, что поверхность
готова, но провайдер выпускается только при заданной конфигурации.

| Провайдер | desktop web | mobile web | Android | iPhone (iOS) | Реализация |
|---|---|---|---|---|---|
| Email + пароль | да | да | да | да | `api/auth.ts` |
| Google | да | да | да | да | `GoogleSignInButton.web.tsx` (GSI) / `.native.tsx` |
| Facebook | гейт `EXPO_PUBLIC_FACEBOOK_LOGIN_ENABLED` | тот же гейт | тот же гейт | тот же гейт, режим Limited Login (#1918) | `FacebookAuthFlow.shared.tsx` |
| Apple | гейт `EXPO_PUBLIC_APPLE_WEB_CLIENT_ID` + `..._REDIRECT_URI` | тот же гейт | **нет** | да | `AppleSignInButton.web.tsx` / `.native.tsx` |

Apple в Android-приложении отсутствует осознанно: `expo-apple-authentication`
на не-iOS отдаёт `isAvailableAsync() === false`. Аккаунт, созданный через Apple,
попадает в Android-приложение только через email + пароль — см. «Известные
ограничения».

### Facebook на iPhone: Limited Login без ATT (#1918)

На iOS Meta даёт классический Facebook Login (access token Graph API) только
после согласия App Tracking Transparency. ATT приложение не запрашивает и в
форме App Privacy остаётся `tracking=false`, поэтому iPhone ходит вторым
маршрутом — **Limited Login**: `LoginManager.logInWithPermissions(permissions,
'limited', nonce)` и `AuthenticationToken.getAuthenticationTokenIOS()`
(`components/auth/FacebookSignInButton.native.tsx`). Результат входа — OIDC-JWT
и nonce, а не access token.

Отсюда `FacebookCredential` — размеченное объединение (`api/auth.ts` →
`FacebookCredentialPayload`): `kind: 'access_token'` для web и Android,
`kind: 'authentication_token'` для iPhone. `facebookAuthApi` шлёт на
`POST /user/facebook-login/` либо `{access_token}`, либо
`{authentication_token, nonce}`; ответы, коды ошибок и сценарий дополнения
email общие для всех платформ (приём OIDC-токена на сервере — #1912).

Источник случайности nonce — нативный `expo-crypto` (`getRandomValues`), а не
`globalThis.crypto`: Hermes на устройстве Web Crypto не реализует, и опора
только на него давала пустой nonce и мёртвую кнопку при зелёных unit-тестах
(`NATIVE-WEB-CRYPTO-ABSENT-001`). Нулевой буфер считается отказом источника —
попытка входа не начинается.

Nonce генерируется криптографически на каждую попытку и проверяется дважды:
клиент отбрасывает токен, чей claim `nonce` не совпал с nonce этой попытки
(чужой или устаревший токен), сервер сверяет то же значение с claim JWT. Набор
разрешений в limited-режиме приходит не всегда: пустой набор — «неизвестно», и
решение о дополнении email принимает сервер (`facebook_email_completion_required`).

Meta SDK снова линкуется в iOS-сборку, но только в конфигурации без трекинга:
`FacebookAutoInitEnabled=false` (SDK поднимает кнопка входа при монтировании,
вне экрана входа Meta-код не исполняется), `FacebookAutoLogAppEventsEnabled=false`,
`FacebookAdvertiserIDCollectionEnabled=false` в `ios/metravel/Info.plist`; App
Events, Advertiser ID и ATT-запрос не используются. Состояние машинно
проверяется: `ios:release:guard` (`IOS_META_SDK_CONFIG` — SDK залинкован, ключи
и схемы Meta на месте, три флага `false`, iOS-ветка вызывает `'limited'` и не
просит `'enabled'`, заглушки `.ios.tsx` нет) и `ios:artifact:audit`
(`IOS_ARTIFACT_SDK_TRACKING` — tracking-манифест допустим только у бандлов
`FBSDK*`/`FBAEMKit*` и только при выключенных флагах; трекинг любого другого SDK
и app-owned манифеста — ошибка). До #1918 действовал обратный контракт: #1895
убирал SDK из сборки целиком.

Кнопка на iPhone остаётся за флагом сборки `EXPO_PUBLIC_FACEBOOK_LOGIN_ENABLED`
(плюс `EXPO_PUBLIC_META_APP_ID`); облачная сборка берёт их из EAS environment
variables, локальный `.env` туда не попадает.

## Email: причина отказа входа и сброс пароля (#2042)

Бэкенд #1993 не раскрывает, есть ли аккаунт с почтой; клиент не восстанавливает
это различие сам:

- отказ входа выбирает `code` тела `401`: `account_not_activated` (бэкенд отдаёт
  его только после проверки пароля) — подсказка активации, `invalid_credentials`
  и любой другой код — общий «Неверный email или пароль». Текст ответа решает
  только при отсутствии `code` — fallback для старого бэкенда;
- «Забыли пароль?» на любой `2xx` показывает одну нейтральную строку «Если
  аккаунт с такой почтой существует, мы отправили…» — одинаковую для известного
  и неизвестного адреса; `400` — «Введите корректный email», `429` — «Слишком
  много попыток»;
- строка сервера не показывается нигде (#1946), успех или ошибку формы решает
  статус ответа, а не текст сообщения.

Требования — OpenSpec change `consume-auth-rejection-codes`, capability
`email-auth-feedback`; unit — `__tests__/api/travels.auth.test.ts`,
`__tests__/utils/authFailure.test.ts`, `__tests__/components/login.test.tsx`.

## Веб-вход через Apple (#1506)

Аккаунт, созданный в iPhone-приложении через Sign in with Apple, пароля не имеет.
До #1506 на вебе кнопки Apple не было, и такой пользователь не мог войти на
сайт вообще — а при «Скрыть мою почту» не работал и сброс пароля.

Оболочка кнопки общая с Facebook — `components/auth/SocialAuthButton.web.tsx`:
геометрия, состояния и accessibility живут одним экземпляром, снаружи приходят
только бренд-цвета и логотип. Google под неё не заводится: его кнопку рисует
сам GSI.

Механизм: `components/auth/AppleSignInButton.web.tsx` подключает Apple JS SDK
тегом `<script>` при монтировании формы и открывает popup
(`AppleID.auth.signIn()`). Popup отдаёт `id_token` прямо в JS, поэтому дальше
переиспользуется уже существующий контракт `POST /user/apple-login/` (#1412) и
общий разбор сессии `parseSocialSession`.

Почему popup, а не редирект `response_mode=form_post`: редирект отдаёт токен на
сервер, а не в браузер, и потребовал бы отдельного callback-эндпоинта, обмена
одноразовым кодом и своей ветки в auth — нового контракта там, где хватает
существующего.

Отличия от нативной поверхности, осознанные:

- кнопка своя (`Pressable` + инлайн-логотип), а не системная: HIG разрешает
  custom-кнопку на вебе, и только так надпись проходит через `@/i18n` и
  получает BE и UK, которых нет в списке локалей Apple JS SDK;
- локаль самого SDK зафиксирована как `en_US`: файл лежит по пути с локалью и на
  неподдерживаемой отдаёт 404, а его собственные строки видны только в его
  кнопке, которую мы не рисуем. Страницу входа Apple локализует сама;
- в запрос добавляется `client_id`: у веба свой audience (Services ID), у
  приложения — bundle ID, и ключ проверки на сервере у них разный.

### Конфигурация

| Переменная | Значение |
|---|---|
| `EXPO_PUBLIC_APPLE_WEB_CLIENT_ID` | Services ID из Apple Developer (не bundle ID приложения) |
| `EXPO_PUBLIC_APPLE_WEB_REDIRECT_URI` | Return URL, зарегистрированный у того же Services ID; обязателен и в popup-режиме |

Пока обе переменные не заданы, кнопка не рендерится и веб-формы остаются
прежними. Это конфигурационный гейт того же вида, что
`EXPO_PUBLIC_FACEBOOK_LOGIN_ENABLED`, а не заглушка.

CSP выполнена в `#1508`: production-политика разрешает
`https://appleid.cdn-apple.com` в `script-src` и `https://appleid.apple.com` в
`connect-src` и `frame-src`, поэтому этот слой больше не блокирует Apple JS SDK.
Конфигурация nginx backend-owned: правится только в
`deploy/prod/nginx/nginx.conf` backend-репозитория, задача `#1508`. Файл
`nginx/nginx.conf` в этом репозитории — read-only копия, его правка на прод не
влияет (`docs/RULES.md` → «Nginx config ownership»). Проверка факта:

```bash
curl -sI https://metravel.by/ | tr ';' '\n' | grep -iE 'script-src|connect-src|frame-src'
```

### Что должен сделать владелец в Apple Developer

Агент этих шагов не выполняет — они требуют доступа к аккаунту Apple.

1. `Certificates, Identifiers & Profiles` → `Identifiers` → создать
   **Services ID** (например `by.metravel.web`) и включить ему Sign in with Apple,
   привязав к тому же Primary App ID, что и приложение (`by.metravel.app`), —
   иначе Apple выдаст пользователю другой `sub`, и вход создаст второй аккаунт.
2. В настройках Services ID → `Domains and Subdomains`: `metravel.by`;
   `Return URLs`: точный `https`-URL из `EXPO_PUBLIC_APPLE_WEB_REDIRECT_URI`.
3. Скачать `apple-developer-domain-association.txt` и выложить его по
   `https://metravel.by/.well-known/apple-developer-domain-association.txt`,
   затем нажать `Verify`.
4. `Sign in with Apple for Email Communication` → `Email Sources`: зарегистрировать
   домен и адрес отправителя писем MeTravel с SPF/DKIM. Без этого Apple не
   пересылает письма на `@privaterelay.appleid.com`, и сброс пароля для
   пользователей со «Скрыть мою почту» не работает.

## Известные ограничения

- **Android + Apple.** В Android-приложении кнопки Apple нет и на веб-флоу оно не
  переключается. Пользователь с Apple-аккаунтом заходит туда только по email +
  паролю, то есть после установки пароля письмом. Тот же класс проблемы, что
  #1506, но другая поверхность.
- **«Скрыть мою почту».** Адрес вида `xxx@privaterelay.appleid.com` доставляем
  только после регистрации Email Source (шаг 4 выше). До этого письма
  подтверждения и сброса пароля до такого пользователя не доходят.
- **Имя от Apple.** `name` приходит только при ПЕРВОМ входе — и на вебе, и в
  приложении. Сервер сохраняет его один раз; повторные входы имя не присылают.

## Проверка

- unit: `__tests__/components/auth/AppleSignInButton.web.test.ts` (чистые
  функции), `__tests__/components/auth/AppleSignInButton.web.render.test.tsx`
  (поведение кнопки целиком), `__tests__/api/appleAuth.test.ts`;
- браузер: desktop 1280 и mobile 390 — кнопка в соц-блоке `/login` и
  `/registration`, порядок Apple → Google → Facebook, тёмная и светлая темы;
- end-to-end (требует шагов владельца выше и серверного audience): аккаунт,
  созданный через Apple на iPhone, входит на metravel.by и попадает в тот же
  аккаунт, а не в дубликат.
