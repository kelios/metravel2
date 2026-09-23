# Facebook Login design evidence

Статус на 24.09.2026: реализовано на всех поверхностях; выпущено на web и
Android, на iPhone ждёт первой сборки с включённым флагом. Состояние выпуска по
платформам и его доказательства — `docs/features/auth.md` → «Facebook: состояние
выпуска»; этот документ описывает нормативные экраны, состояния и контракт.

- Web — `#963` (JS SDK, `components/auth/FacebookSignInButton.web.tsx`).
- Android — `#981` (native `react-native-fbsdk-next`, классический access token,
  `components/auth/FacebookSignInButton.native.tsx`); web SDK native не подменяет.
- iPhone — `#1918` (тот же native-файл, режим Meta Limited Login: OIDC-токен и
  nonce вместо access token, без ATT).
- Backend — `POST /api/user/facebook-login/` (`#962`, приём OIDC-токена `#1912`),
  один контракт ответов и дополнения email для всех платформ.
- Приложение Meta `meTravel.by` (2443100196153960) опубликовано (Live) 23.09.2026
  (`#1917`): вход доступен любому аккаунту Facebook, а не только аккаунтам с
  ролью в приложении.

## Layout

- Существующая email-форма и основная submit-кнопка не меняются.
- Социальные действия идут вертикально в порядке Apple → Google → Facebook
  (`components/auth/LoginForm.tsx:348`), с одинаковой шириной, высотой не менее
  48 px и расстоянием по существующей auth-card сетке. Невыпущенный провайдер
  не рендерится.
- Facebook action использует официальный знак `f`, видимую подпись
  «Войти через Facebook» и не подменяет регистрацию отдельной формой:
  первый успешный вход создаёт аккаунт, повторный открывает тот же аккаунт.
- Ссылки «Зарегистрироваться»/«Войти» остаются последним блоком карточки.

## States

- `ready`: обе social actions доступны;
- `loading`: Facebook action показывает progress, все submit/social actions
  временно disabled, повторный запрос невозможен;
- `cancelled`: модальное окно закрывается без error state;
- `error`: локализованное inline-сообщение над действиями, введённые email и
  password не очищаются;
- `success`: сохраняются существующие `redirect` и `intent`, затем выполняется
  тот же post-auth navigation, что у Google/email login;
- `unavailable`: при отсутствии публичного App ID action disabled с
  локализованным объяснением; App Secret никогда не попадает в клиент.
- `email_permission_missing`: первый SDK callback без `email` scope не уходит на
  backend и показывает отдельное объяснение; только явный повторный клик вызывает
  повторный запрос `email` (web — `auth_type=rerequest`, native — режим
  `rerequest_email`). На iPhone Limited Login набор разрешений может прийти
  пустым: это «неизвестно», токен уходит на backend, и решение о дополнении email
  принимает сервер (`facebook_email_completion_required`);
- `email_completion`: если после явного re-request Graph всё равно не возвращает
  email, пользователь вводит email и код из письма через server-bound completion
  contract;
- `completion_expired`: использованный или истёкший handle очищается из памяти,
  пользователь начинает Facebook Login заново.

## Secure completion contract

- Токен Facebook (web и Android — `{access_token}`, iPhone —
  `{authentication_token, nonce}`) передаётся только в
  `POST /api/user/facebook-login/` и не сохраняется в
  state/storage/URL/analytics/logs.
- Backend может вернуть opaque `completion_handle`; он хранится только в памяти
  текущей формы и не заменяет Facebook token.
- `POST /api/user/facebook-login/complete/start/` отправляет код на введённый
  email, а `/complete/confirm/` создаёт session только после правильного кода.
- UI не создаёт synthetic email, не показывает fake success и не выполняет
  автоматический permission re-request loop.

## Localization and accessibility

Все подписи, loading/unavailable/error и accessibility labels принадлежат
auth/error namespaces и обязательны для RU/BE/UK/PL/EN. Кнопка доступна с
клавиатуры, имеет `button` semantics, disabled/busy state и видимый focus.

## Runtime comparison

Done evidence для `#963`: screenshots `/login` и `/registration` в desktop и
mobile web, keyboard focus, browser console/network без новых ошибок и production
Facebook OAuth smoke против endpoint из `#962`. Android принят в `#981`
(релизная сборка на Pixel: первый вход создал аккаунт, повторный вошёл в тот
же). iPhone принимается на точной TestFlight-сборке с включённым флагом
(`#1939`/`#1940`). Повторная проверка выпуска — `docs/features/auth.md` →
«Facebook: состояние выпуска».
