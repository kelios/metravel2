## Purpose

Серверный контракт входа через Facebook: сервер MeTravel принимает и проверяет как классический access token Graph API, так и OIDC authentication token режима Limited Login, и выдаёт одну и ту же сессию MeTravel.

## ADDED Requirements

### Requirement: Facebook login endpoint accepts an OIDC authentication token
Точка входа через Facebook SHALL принимать credential одного из двух видов: `access_token` (как сейчас) либо пару `authentication_token` и `nonce`. Запрос без любого credential или с обоими видами одновременно MUST отклоняться как некорректный.

#### Scenario: Authentication token accepted
- **WHEN** запрос содержит действительный `authentication_token` и совпадающий `nonce`
- **THEN** сервер отвечает той же структурой успешного входа (токен сессии, имя, email, идентификатор, признак суперпользователя), что и для `access_token`

#### Scenario: Access token still accepted
- **WHEN** запрос содержит только действительный `access_token`
- **THEN** поведение не отличается от текущего

#### Scenario: Missing credential
- **WHEN** запрос не содержит ни `access_token`, ни `authentication_token`
- **THEN** сервер отвечает ошибкой валидации с кодом, обозначающим отсутствие credential

### Requirement: OIDC token is verified before use
Сервер SHALL принимать authentication token только если подпись проверена ключом из опубликованного Meta набора JWKS, издатель равен `https://www.facebook.com`, аудитория равна идентификатору приложения MeTravel в Meta, срок действия не истёк, а `nonce` из запроса совпадает с claim `nonce` токена. Любое нарушение MUST приводить к тому же ответу «токен недействителен», что и для недействительного access token; тело токена и его claims MUST NOT попадать в логи.

#### Scenario: Signature or issuer mismatch
- **WHEN** подпись не проходит проверку или издатель/аудитория не совпадают
- **THEN** сервер отвечает ошибкой «токен недействителен» без раскрытия причины

#### Scenario: Nonce mismatch
- **WHEN** `nonce` запроса не равен claim `nonce` токена
- **THEN** сервер отвечает ошибкой «токен недействителен»

#### Scenario: Expired token
- **WHEN** срок действия токена истёк
- **THEN** сервер отвечает ошибкой «токен недействителен»

#### Scenario: JWKS unavailable
- **WHEN** набор ключей Meta недоступен и кэшированных ключей нет
- **THEN** сервер отвечает ошибкой «сервис Facebook недоступен», как при недоступности Graph API

### Requirement: Identity from the OIDC token maps to the same account model
Сервер SHALL использовать claim `sub` как идентификатор пользователя Facebook, `email` как email и `name` как отображаемое имя, применяя те же правила линковки существующего аккаунта, создания нового и дополнения email, что для access token; отсутствие `email` или `picture` в claims MUST обрабатываться так же, как отсутствие соответствующего поля в профиле Graph API.

#### Scenario: Same Facebook user via both token types
- **GIVEN** пользователь ранее входил через Facebook с access token
- **WHEN** тот же пользователь входит с authentication token, у которого `sub` равен его Facebook-идентификатору
- **THEN** сервер выдаёт сессию того же аккаунта MeTravel

#### Scenario: Email absent in claims
- **WHEN** authentication token не содержит `email`
- **THEN** сервер отвечает требованием дополнить email с тем же кодом и handle, что для access token без email
