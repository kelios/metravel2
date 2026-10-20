## Purpose

Дать владельцу отдельный проверяемый разрез источников и событий вклада автора в разовом и месячном отчётах без изменения собираемой аналитики.

## ADDED Requirements

### Requirement: Independent source and event counts

Отчёт SHALL показывать сырые источник и medium, сессии и счётчики registration_complete, route_create_started, travel_publish. Сессии MUST считаться независимо от разреза событий; счётчики не называются уникальными людьми.

#### Scenario: Instagram and Facebook observed
- **WHEN** за окно получены строки Instagram и Facebook и события с этими источниками
- **THEN** отчёт показывает отдельные строки, независимые сессии и соответствующие счётчики трёх событий
- **AND** исходные source/medium сохраняются, алиасы Instagram не складываются в канальный KPI

### Requirement: Honest missing data and quality

Отчёт MUST различать отсутствие наблюдения, недоступный запрос и ограниченное качество. Отсутствующая строка события SHALL оставаться null, а не выдуманным нулём.

#### Scenario: No Instagram observations
- **WHEN** в ответе нет строк Instagram
- **THEN** отчёт явно показывает отсутствие наблюдений Instagram без утверждения о нулевой конверсии

#### Scenario: Source report is incomplete or unavailable
- **WHEN** источник данных ограничен качеством, не дочитан или возвращает ошибку
- **THEN** соответствующий разрез содержит явный статус и ограничения, а доступные прежние итоги сохраняются
- **AND** секреты и необработанные HTTP-тела ошибки не выводятся

### Requirement: Monthly source breakdown and protected measurement

Месячная сводка SHALL содержать разрез источник/medium/месяц с теми же правилами. Выполнение отчёта MUST быть read-only и сохранять канальный KPI и календарные окна.

#### Scenario: Independent reporting during attribution measurement
- **WHEN** владелец строит разовый или месячный отчёт в окне замера Unassigned
- **THEN** существующие итоги и независимый знаменатель Unassigned сохранены
- **AND** клиентская классификация, согласие и реальные UTM-ссылки не меняются
