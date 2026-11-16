## Purpose

Сохранять одинаковое решение об индексации страны квестов в серверном HTML и документе после выполнения JavaScript, включая клиентские переходы.

## ADDED Requirements

### Requirement: Country robots follows the hub policy
Страница страны SHALL содержать ровно один robots после гидрации и перехода; значение определяется действующей политикой наполненности хаба.

#### Scenario: Thin hub
- **WHEN** открыт тонкий хаб страны
- **THEN** сервер и документ после гидрации содержат `noindex, follow`

#### Scenario: Eligible hub
- **WHEN** открыта страна, проходящая действующее правило хаба
- **THEN** сервер и документ после гидрации содержат `index, follow`

#### Scenario: Client navigation
- **WHEN** посетитель переходит с тонкого хаба на индексируемый и обратно
- **THEN** в документе ровно один robots текущей страны

### Requirement: Build-owned decisions remain intact
Страницы городов и деталей SHALL сохранять серверный `noindex, follow` после гидрации, если решение доступно только при публикации.

#### Scenario: Non-indexable city or quest
- **WHEN** страница города или квеста с серверным noindex загружается с JavaScript
- **THEN** в документе остаётся ровно один robots `noindex, follow`
