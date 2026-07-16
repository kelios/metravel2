# Facebook Login design evidence

Статус: implemented behind disabled rollout flag, blocked by backend task `#962`.

Нормативные экраны: web `/login` и `/registration`. Android/iOS в текущий
scope не входят.

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

## Localization and accessibility

Все подписи, loading/unavailable/error и accessibility labels принадлежат
auth/error namespaces и обязательны для RU/BE/UK/PL/EN. Кнопка доступна с
клавиатуры, имеет `button` semantics, disabled/busy state и видимый focus.

## Runtime comparison

Done evidence: screenshots `/login` и `/registration` в desktop и mobile web,
проверка ready/loading/error/success, keyboard focus, browser console/network
без новых ошибок и production Facebook OAuth smoke против endpoint из `#962`.
