## Purpose

Выбор проверок должен доказывать изменённый контракт минимальным достаточным
evidence и не превращать список поддерживаемых платформ в обязательный прогон.

## ADDED Requirements

### Requirement: Select evidence before preparing targets

Агент MUST сопоставить всё ещё не принятое task-owned изменение с наблюдаемым
контрактом, assertion и ближайшим достаточным проверочным слоем до назначения
tester, подготовки устройств, stamp, build/install или runtime-проб. Для каждого
добавленного target SHALL быть отдельная изменённая граница либо явный текущий
запрос пользователя; существующее совместимое evidence MUST переиспользоваться.

#### Scenario: Shared route and stale native binaries
- **WHEN** меняется общий маршрут и регрессионный тест, старая карточка перечисляет Android/iOS, а их бинарники устарели
- **THEN** агент выбирает проверку общей логики и нужный representative web-flow, уточняет старую матрицу и не начинает native readiness/build только из-за списка платформ

#### Scenario: Separate web and native implementations
- **WHEN** изменён web-компонент или web-геометрия, а отдельные native-компоненты сохранены
- **THEN** требуются затронутые web-состояния; Android/iPhone не добавляются по названию домена или наличию native sibling

#### Scenario: Native-specific implementation
- **WHEN** меняется отдельная iOS-интеграция
- **THEN** выбирается подходящий iOS-слой и его предусловия; Android/web добавляются только с отдельным обоснованием

#### Scenario: Instruction-only maintenance
- **WHEN** меняются skills, prompts, agents, docs и их статический guard
- **THEN** выполняются structural/prompt/skill validators и focused guard regression; app builds, browser/device QA и deploy не назначаются

### Requirement: Preserve explicit validation authority and evidence reuse

Действующая явная full-QA/release-матрица пользователя MUST сохраняться.
Унаследованный список платформ и команда закончить карточку SHALL NOT сами
становиться новой release-матрицей. Уточнение избыточного контракта MUST
фиксировать причину и оставшиеся обязательные проверки без снижения capability,
security или store gates.

#### Scenario: Explicit current native release matrix
- **WHEN** пользователь явно заказал native release-матрицу и точный кандидат, в том числе в более раннем сообщении, и не отменил этот запрос
- **THEN** обязательные native/capability/candidate проверки сохраняются при последующем «продолжай» и не заменяются web-evidence

#### Scenario: Unrelated change after passing evidence
- **WHEN** evidence остаётся совместимым по исходникам, зависимостям, окружению и проверяемому контракту, а изменён посторонний файл
- **THEN** принимается прежний результат и выполняется только реально требуемая дополнительная проверка или publish smoke

### Requirement: Reject instruction drift before execution

Canonical consumers SHALL ссылаться на единый выбор проверок до runtime
предусловий. Prompt audit MUST отклонять потерю этой ссылки и известные
безусловные требования native-паритета или раннюю native-маршрутизацию общих
агентов. Статический аудит SHALL NOT объявляться доказательством произвольного
поведения модели.

#### Scenario: Old blanket requirement returns
- **WHEN** в действующий prompt возвращается требование проверять каждую заявленную поверхность либо каждый web-экран на native
- **THEN** prompt audit завершается ошибкой на соответствующем canonical источнике
