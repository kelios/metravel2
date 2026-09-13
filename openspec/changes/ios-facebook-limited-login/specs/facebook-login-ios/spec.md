## Purpose

Вход через Facebook в iPhone-приложении MeTravel в режиме Limited Login: пользователь входит той же учётной записью, что на сайте и в Android, а приложение не запрашивает App Tracking Transparency и не ведёт трекинг.

## ADDED Requirements

### Requirement: Facebook sign-in is offered on iPhone
Экраны входа и регистрации iPhone-приложения SHALL показывать кнопку входа через Facebook рядом с Apple и Google, когда конфигурация сборки включает Facebook-вход и задан идентификатор приложения Meta.

#### Scenario: Button is visible on a configured build
- **GIVEN** сборка iPhone-приложения с включённым Facebook-входом и идентификатором приложения Meta
- **WHEN** пользователь открывает экран входа или регистрации
- **THEN** среди социальных кнопок есть кнопка Facebook с локализованной подписью на текущей локали (RU/BE/UK/PL/EN) и размером касания не меньше 44 pt

#### Scenario: Button is absent on an unconfigured build
- **GIVEN** сборка без включённого Facebook-входа или без идентификатора приложения Meta
- **WHEN** пользователь открывает экран входа
- **THEN** кнопки Facebook нет, остальные способы входа доступны

### Requirement: iPhone uses Limited Login without App Tracking Transparency
iPhone-приложение SHALL выполнять вход через Facebook в режиме Limited Login: запрашивать только разрешения `public_profile` и `email`, передавать уникальный nonce на каждую попытку и получать OIDC authentication token; приложение MUST NOT показывать системный запрос App Tracking Transparency и MUST NOT запрашивать классический access token Graph API.

#### Scenario: Successful sign-in
- **WHEN** пользователь нажимает кнопку Facebook и подтверждает вход в диалоге Facebook
- **THEN** приложение получает authentication token и nonce, отправляет их серверу MeTravel и после успешного ответа переводит пользователя в авторизованное состояние без запроса App Tracking Transparency

#### Scenario: User cancels the Facebook dialog
- **WHEN** пользователь закрывает диалог Facebook без подтверждения
- **THEN** приложение остаётся на экране входа без сообщения об ошибке и без сетевого запроса к серверу MeTravel

#### Scenario: Facebook did not grant email
- **WHEN** вход подтверждён, но разрешение на email не выдано или сервер сообщил, что требуется дополнение email
- **THEN** приложение показывает тот же сценарий подтверждения email, что на web и Android, включая повторный запрос разрешения `email`

#### Scenario: Server rejects the token
- **WHEN** сервер MeTravel отвечает, что токен недействителен
- **THEN** приложение показывает локализованное сообщение об ошибке входа и остаётся на экране входа

#### Scenario: Network is unavailable
- **WHEN** запрос к серверу MeTravel не доходит из-за отсутствия сети или таймаута
- **THEN** приложение показывает локализованное сообщение о сетевой ошибке, повторный тап по кнопке начинает новую попытку с новым nonce

### Requirement: Meta SDK ships only in the no-tracking configuration
iOS-сборка SHALL содержать Meta SDK только с выключенным автологированием событий приложения и выключенным сбором advertiser ID; собственный privacy manifest приложения и форма App Privacy MUST оставаться без трекинга.

#### Scenario: Release gate accepts the Limited Login configuration
- **WHEN** запускается проверка конфигурации iOS-релиза
- **THEN** проверка проходит, если в конфигурации приложения автологирование событий и сбор advertiser ID выключены, идентификатор и схема URL приложения Meta заданы, а код входа на iOS использует режим Limited Login

#### Scenario: Release gate rejects a tracking configuration
- **WHEN** в конфигурации включено автологирование событий или сбор advertiser ID, либо код входа на iOS запрашивает классический режим с трекингом
- **THEN** проверка конфигурации завершается ошибкой с указанием нарушенного условия

#### Scenario: Archive audit distinguishes Meta bundles from other tracking SDKs
- **WHEN** аудит собранного архива находит privacy manifest с объявленным трекингом
- **THEN** аудит проходит только для манифестов бандлов Meta SDK при выполненных условиях конфигурации без трекинга и завершается ошибкой для любого другого SDK с объявленным трекингом

### Requirement: Web and Android sign-in stay unchanged
Вход через Facebook на web и Android SHALL продолжать использовать access token и существующие сценарии дополнения email и линковки аккаунтов без изменений.

#### Scenario: Android sign-in after the change
- **WHEN** пользователь Android-приложения входит через Facebook
- **THEN** сервер получает access token, как до изменения, и вход завершается прежним образом

#### Scenario: Web sign-in after the change
- **WHEN** пользователь сайта входит через Facebook в браузере
- **THEN** сервер получает access token, как до изменения, и вход завершается прежним образом
