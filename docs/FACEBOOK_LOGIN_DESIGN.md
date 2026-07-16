# Facebook Login design evidence

Статус: web flow implemented; production email-completion runtime evidence ждёт
deploy backend task `#962`.

Нормативные экраны: desktop/mobile web `/login` и `/registration` плюс тот же
flow на Android. iOS в текущий scope не входит.

Текущая задача `#963` реализует только web-вариант. Android здесь остаётся
целевым parity-контрактом для отдельной native-задачи: web SDK не подменяет
native Facebook SDK, а защищённые `app.json`/native config не меняются без
отдельного разрешённого scope.

## Layout

- Существующая email-форма и основная submit-кнопка не меняются.
- После разделителя «или» социальные действия идут вертикально: Google,
  затем Facebook, с одинаковой шириной, высотой не менее 48 px и расстоянием
  по существующей auth-card сетке.
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
  `auth_type=rerequest`;
- `email_completion`: если после явного re-request Graph всё равно не возвращает
  email, пользователь вводит email и код из письма через server-bound completion
  contract;
- `completion_expired`: использованный или истёкший handle очищается из памяти,
  пользователь начинает Facebook Login заново.

## Secure completion contract

- Facebook user access token передаётся только в `POST /api/user/facebook-login/`
  и не сохраняется в state/storage/URL/analytics/logs.
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
Facebook OAuth smoke против endpoint из `#962`. Android parity принимается в
отдельной native-задаче после согласования SDK/config scope.
