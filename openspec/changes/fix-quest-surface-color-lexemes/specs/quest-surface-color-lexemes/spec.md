## Purpose

Определять цветовую зависимость ответа квеста по самостоятельным цветовым словам и их формам, сохраняя обнаружение нового изменяемого эталона без ложных совпадений внутри посторонних слов.

## ADDED Requirements

### Requirement: Color recognition uses lexical forms

Surface-answer selection MUST recognize supported color words and inflections as complete lexical forms in both task wording and closed answer dictionaries. A color root embedded in an unrelated word MUST NOT itself provide evidence of color dependence. Hyphenated, spaced and supported RU joined compound colors and supported shade inflections SHALL remain recognized.

#### Scenario: Preservation does not mean ochre
- **WHEN** a task asks «Зайди в музей и найди сохранённую тюремную камеру. Кто в ней сидел в 1933 году? Назови фамилию, под которой его знает весь мир.» with a closed surname answer
- **THEN** the step has no color-dependence finding from «сохранённую»

#### Scenario: Genuine ochre remains a color
- **WHEN** a supported color answer is «охра», «охристая» or «тёмно-охристая»
- **THEN** the color criterion recognizes the answer

#### Scenario: Unrelated short-root collisions
- **WHEN** a task has «синагога», «обелиск», «обсерватория», «серия», «охранный» or «сервиз» and no independent color or material evidence
- **THEN** none of those words creates a surface-color finding

#### Scenario: Inflections and shade words
- **WHEN** supported answers include «синих», «красноватый», «белоснежные», «темнокрасный», «красно-коричневый», «czerwony», «niebieskich», «блакитний», «чырвоны», «grün» or «white»
- **THEN** the color criterion recognizes each supplied color word

#### Scenario: Genuine forms outside the historical corpus
- **WHEN** supported forms include «серебристый», «серебро», «терракота», «белёсый», «синева», «niebieskie», «srebrzysty», «czerwonawe», «белы», «синій», «синю», «зелені», «жовтою» or «grünlich»
- **THEN** each remains color evidence in both an exact answer and a counting/filter task

### Requirement: Surface-risk coverage remains independent of false-word removal

Selection MUST retain direct color questions, color-dependent counting, real color dictionaries, visible surface materials and the structural-material exclusion. Removing unrelated lexical collisions MUST NOT suppress an independent valid risk signal. Historical criterion revisions MUST enumerate every changed finding and preserve all actually resolved surface-risk cases.

#### Scenario: Counting green objects
- **WHEN** a task asks «Сколько зелёных башенок?» with a numeric answer
- **THEN** the step remains a surface-risk finding through color-dependent counting

#### Scenario: Independent material branch
- **WHEN** a step has a supported brick or roof-tile surface-material answer and no color word
- **THEN** the surface-material finding remains

#### Scenario: Structural material remains excluded
- **WHEN** an answer describes timber, stone or the material forming an artwork itself
- **THEN** structural classification remains outside surface-risk selection

#### Scenario: Historical resolved cases remain covered
- **GIVEN** the previously audited corpus has 60 resolved cases, 47 excluded candidates and 40 structural cases
- **WHEN** the revised lexical criterion removes 22 unrelated-word candidates
- **THEN** all 22 removals belong to the previously excluded group, all 60 resolved cases and all 40 structural cases remain, and the new normative split is 60+25+40=125

### Requirement: Baseline remains sensitive to new color values

Every recognized accepted color value MUST contribute its own finding identity. A new accepted color or replacement of a previously known color MUST require a new verdict. Existing baseline entries SHALL NOT be expanded to hide lexical-classification failures.

#### Scenario: Repainting changes the finding identity
- **GIVEN** the previously accepted «синий» finding is known
- **WHEN** an otherwise identical step changes its accepted color to «белый»
- **THEN** «белый» is reported as a new finding requiring a verdict

#### Scenario: Empty dictionary preserves explicit questions
- **WHEN** a step has an empty dictionary and asks «Какого цвета?»
- **THEN** the direct color question still selects the step
