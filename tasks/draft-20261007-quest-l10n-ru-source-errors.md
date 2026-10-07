# TASK-DRAFT-20261007-QUEST-L10N-RU-SOURCE: [FE-QUEST-L10N] Ошибки русских источников квестов, найденные при переводе 07.10.2026

Status: Review
Owner: quest-editor
Support: quest-translator, review-auditor, code-review-gate, board-reviewer
Created: 2026-10-07
Updated: 2026-10-07

> Временный fallback-черновик (`tasks/README.md`): в этой cloud-сессии MCP-борд не
> стартует (нет `.secrets/metravel-task-board.env` и backend-checkout), а REST
> `/api/tasks/` отвечает `401 Invalid token` — токен, который прокси подставляет
> для `metravel.by/api/`, протух. После восстановления доступа создать карточку
> на борде: серия `QUEST-L10N`, зона `quest-editor`, `area=front`, `kind=bug`,
> `urgency=medium`, связать с карточкой `area=back` из
> `tasks/draft-20261007-quest-city-dedupe-back.md`, затем удалить оба файла.

## Простыми словами

Что сейчас: при переводе квестов на пять языков переводчики наткнулись на
ошибки в самом русском тексте — подсказки выдают ответ, задания зовут нажать
кнопку, которой в приложении нет, факты в соседних шагах противоречат друг
другу, в словарях ответов опечатки. Пока русский источник кривой, кривым
уходит и каждый перевод.
Как должно быть: русский источник выправлен на проде, переводы после правки
сами становятся `stale` и подтягиваются инкрементальным
`npm run quest:translate -- prepare`; шаблонные ошибки (кнопка «Ответить»)
ловит гейт, а не глаз переводчика.
Кого задевает: игроков 70 квестов, где текст зовёт нажать «Ответить» или
«Дальше»; игроков 21 квеста с фактическими и логическими ошибками;
переводчиков и проверяющих перевода.

## Goal

Исправить перечисленные ошибки русских источников на проде через
`scripts/sync-quest-to-prod.js`, закрыть семейство «несуществующая кнопка»
сканом в `check:fast`, а конвейер перевода снабдить тем, чего не хватало
переводчикам (подписи кнопок мастера, правило ответа у счётных шагов).

## Context

Список ошибок — от владельца, по итогам перевода 07.10.2026; шаги названы по
числовому `id` из бандла `GET /api/quests/by-quest-id/<quest_id>/`. Правила —
`.claude/skills/metravel-quest/SKILL.md` (4a утечка ответа, 4h «Пропустить»,
новое 4i «кнопка, которой нет»). Правки живых квестов — только через
`sync-quest-to-prod.js` после сверки `scan-quest-prod-drift.js` (#1554).

## В чём проблема

### Системные (шаблон привалов)

- Кнопка «Ответить» / «Дальше» в задании при том, что мастер показывает только
  «Далее» (шаг без проверки) и «Проверить ответ» (шаг с полем ввода),
  `components/quests/questWizardStepCard.tsx`. Названо владельцем: gomel-palace
  349, 227; minsk-cmok 215; krevo-walled-maiden 800; golshany-black-monk 763;
  minsk-teens-oktyabrskaya 1133, 1134; minsk-cinema 1158. Скан по каталогу
  (`node scripts/scan-quest-button-labels.js --source=<file>` по всем 200
  локальным data-файлам) добавил ещё 61 шаг в 43 файлах: «Ответить» 41,
  «Дальше»/«дальше» 19, «Завершить» 1 (minsk-kids-zvezdochka 7-planetariy). Все
  70 — шаги типа `any`, ожидаемая кнопка везде «Далее»; 3 находки лежат только
  в устаревших локальных копиях Астаны и Туркестана (на проде их нет), так что
  исправлено 67.
  `npm run quest:scan-skip-promise` этого не видел: он ловит только «Пропустить».
- Шаблонная подсказка-заглушка «Ищи не весь вид сразу, а одну устойчивую
  деталь…» на опциональной точке: gomel-kids-park-secrets 991 и ещё четыре шага
  того же шаблона — brest-kids-fonari 3-chasy, grodno-kids-zveri 3-privalcafe,
  minsk-kids-bronze-friends 4-dom-prirody и 8-park-gorkogo.

### Утечка ответа в story/hint (QUEST-HINT-LEAK-001)

- gomel-palace 174: hint содержит «bel vedere» при ответе «бельведер»; 176: hint
  почти называет ответ (обожжённые глиняные пластины под глазурью).
- krakow-dragon 81: story называет «бронзовой голове», ответ следующего по
  порядку шага 79 — «голова».
- yerevan-ararat 72: story называет «вулканическое стекло» (принимаемый ответ);
  78: story называет «оружие» (принимаемый ответ).
- golshany-black-monk 764: hint «центральный герой христианства».
- gomel-kids-park-secrets 986: задание содержит «симметричным» и принимает «да»
  на вопрос с «или».
- minsk-cmok 106: story «кровельную плитку» при ответе «черепица».
- warsaw-syrenka 117: story «гусеничные машины» при ответе «гусеница».

### Фактические и логические расхождения

- gomel-palace 178: заголовок «Граф Паскевич», в тексте «князь» (Фёдор
  Паскевич — князь; скульптура называется «Прогулка с борзыми»).
- nesvizh-radziwill 166: «Слуцкая брама — единственные уцелевшие» (число).
- krakow-podgorze 334: кафе «перед спуском к площади Героев Гетто», хотя
  площадь — первая точка, а кафе стоит между фабрикой Шиндлера и костёлом.
- krakow-dragon 110: «мост между небом и землёй», выставка в 82 — «Между водой
  и небом»; 111: hint предполагает несколько голов у дракона.
- novogrudok-crown 430: «войнам» → «воинам»; 433: «Тогда Адаму Мицкевичу было
  тринадцать» стоит после «1953-м»; финал: «его татарских воинов» грамматически
  про Миндовга, татар поселил Витовт.
- antalya-kaleici 487: «ворота императора из названия нашего квеста» — в
  названии этого нет; 488/489: «улица Хесапчи» и «Хесапчи-сокак» вразнобой.
- golshany-black-monk 765: «Историю его строили долго»; «ровно за год» не
  сходится с 25.07.1900–09.12.1901; 767: надпись на камне дана русским
  пересказом в кавычках, не белорусским оригиналом.
- gervyaty-kostel 725: «шестидесятиметровая» против 61 м в других шагах; 725
  называет мельницу конечной точкой, последний шаг — мостик.
- pakocim-voices 112: заголовок «Голоса Прокоцина», везде «Прокоцим»; 85, 88:
  story просит «посчитать», задание — описать; 90: заголовок «Каменные стены»,
  ответ — «кирпич».
- yerevan-ararat 75: story «Пересчитай его буквы», задание — описать
  впечатление; 68: «всё ответы»; 72: в answer_variants опечатка «обсидиаан»;
  73: нет варианта «jazzve»/«ibrik».
- minsk-teens-oktyabrskaya: интро «с 2014 по 2019», финал «пять летних
  фестивалей» (Vulica Brasil шёл с 2014 и позже 2019 тоже).
- minsk-cmok 105: заголовок «Артефакт Памяти», в тексте пятый осколок — «Скорбь».
- gomel-soviet 370, 372: в answer_variants смешаны ru/be формы; 372 просит
  «одно общее слово», принимает типы заведений.
- pinsk-polesie 397: «прадед по духу и дед по крови»; 399: мягкий перенос
  U+00AD в слове «возе» (такие же — barkovshchina-spirits «Вглядись», rome
  «берниниевский»).
- gomel-kids-lost-playbill 1046: hint «Ею чувствуют запахи» при ответе «нос»;
  1047 «Последний сказочный артист», но дальше шаг 6; 1048: «он» со строчной
  после «Подсказка для взрослого:».
- warsaw-syrenka 114: «Новомейские ворота» без оригинала; 120: надпись на
  постаменте Коперника дана только по-русски.
- luxembourg-melusina 1483: «ранний барокко» → «раннее».
- krevo-walled-maiden 800: синагогальный двор назван «в начале маршрута», это
  третья точка.

### Данные и конвейер

- Город «Гомель» заведён дважды (quest-city 19 и 92), «Гродно» дважды (11 и 91)
  — дедуп на бэке, отдельная карточка `area=back`
  (`tasks/draft-20261007-quest-city-dedupe-back.md`).
- `quest-translate.js prepare`: `accepted_names` пуст почти для всех городов —
  он собирается только из `location` опубликованных переводов того же города
  (`scripts/quest-translate.js` → `collectAcceptedNames`). Переводчики
  оставляют имена в «ёлочках» в русской форме («Реджеп Гюрген», «Леонид
  Нестюк», «Киевский спуск»), en/pl-игрок их не прочтёт.
- `review-task` для шагов `range`/`approx` не содержал `accepted_answers` —
  проверяющий не мог оценить достижимость числа (lida-castle 153,
  luxembourg-melusina 1483, krakow-dragon 111).
- В `ui_labels` задания перевода не было подписей «Далее»/«Проверить ответ»
  (`questWizardStepCard.dalee_74add698`, `proverit_otvet_76814505`): подпись
  попадала в задание только при дословной цитате в источнике.
- Локальные `scripts/astana-samruk-tree-quest-data.js` и
  `scripts/turkestan-yasawi-quest-data.js` разошлись с продом по всем полям
  всех шагов (QUEST-CONTENT-SOURCE-DRIFT-001): заливка из них откатила бы
  боевой текст.

## Из-за чего возникла

- Кнопки: привалы «☕/✨ (по желанию)» генерировались шаблоном
  (`scripts/add-quest-spots.js`, `scripts/reorder-quest-cafes.js`) с текстом
  «нажми «Ответить»», а ручные опциональные точки копировали «нажми «Дальше»»;
  гейта на подпись кнопки не было — `scan-quest-skip-promise.js` проверяет
  только «Пропустить».
- Утечки и расхождения: авторский текст писался до правил 4a/4g либо
  правился по шагам без перечитывания соседей (порядок шагов в krakow-dragon
  менялся после написания — шаг 81 теперь стоит прямо перед 79).
- Конвейер: `collectUiLabels` (`scripts/lib/questTranslation/task.js`)
  включал подпись только при цитате; `buildReviewTask` брал
  `accepted_answers` из `answer_variants`, которых у `range`/`approx` нет по
  построению.
- Дубли городов: `POST /api/quest-cities/` не дедупит по имени
  (`SKILL.md`, принцип 1), повторная миграция создала второй город.

## Что блокирует

Боевая запись на прод (`sync-quest-to-prod.js --apply`) и создание карточки
на борде: в этой сессии нет действующего staff-токена — прокси подставляет
`METRAVEL_TOKEN`, который `metravel.by` отклоняет (`401 Invalid token`, даже на
публичном `GET /api/quests/by-quest-id/…/`; прямой запрос без прокси отвечает
200). Снимется обновлением токена коннектора или запуском
`METRAVEL_TOKEN=$(node scripts/get-quest-token.js) node scripts/sync-quest-to-prod.js …`
с машины владельца. Код и data-файлы готовы и запушены.

Source task:

- Source id: — (карточка ещё не создана)
- Source path: `tasks/draft-20261007-quest-l10n-ru-source-errors.md`

## Acceptance Criteria

- [ ] Все перечисленные шаги исправлены в `scripts/*-quest-data.js` и
      применены на прод; `GET /api/quests/by-quest-id/<id>/` отдаёт новый текст.
- [ ] `npm run quest:scan-button-labels` по проду — 0 находок; скан входит в
      `check:fast` по изменённому data-файлу.
- [ ] `scan-quest-hint-leak --source=<file>` по всем изменённым файлам — без
      новых находок вне baseline.
- [ ] Задание перевода (`quest:translate prepare`) содержит в `ui_labels`
      кнопки мастера всегда; `*.review-task.json` у `range`/`approx` шагов —
      правило в `accepted_answers` и границы в `answer_rule`.
- [ ] Переводы исправленных квестов помечены `stale` и подтянуты
      инкрементальным `npm run quest:translate -- prepare`.
- [ ] Для Астаны и Туркестана заведена связанная карточка сведения локальных
      файлов с продом (QUEST-CONTENT-SOURCE-DRIFT-001); до неё
      `sync-quest-to-prod.js` по этим двум файлам не запускается.

## Gherkin Tests

```gherkin
Feature: Русский источник квеста без ложных кнопок и утечек

  Scenario: Опциональный привал зовёт нажать кнопку, которая есть
    Given шаг типа any с текстом задания «отдохни и перекуси, а потом нажми «Далее»»
    When игрок открывает шаг в мастере
    Then под заданием стоит единственная кнопка «Далее»

  Scenario: Гейт ловит несуществующую кнопку до заливки
    Given в data-файле задание шага any содержит «нажми «Ответить»»
    When запускается check:fast по изменённому файлу
    Then scan-quest-button-labels возвращает код 1 и называет шаг и ожидаемую подпись «Далее»

  Scenario: Проверяющий перевода видит правило счётного шага
    Given шаг с answer_pattern range {min: 6, max: 8}
    When quest:translate check пишет review-task
    Then accepted_answers шага равен ["число от 6 до 8"]
```

## Task Contract

Scope: контент 65 `scripts/*-quest-data.js` (21 квест из списка владельца, 41
файл шаблона кнопок, 4 детских файла с подсказкой-заглушкой, 3 файла с
U+00AD; множества пересекаются); `scripts/scan-quest-button-labels.js` (новый)
+ тест; `scripts/lib/questTranslation/task.js` + тест; `scripts/run-fast-scope-checks.js`;
`package.json` (скрипты `quest:scan-button-labels[:json]`);
`.claude/skills/metravel-quest/SKILL.md` (правило 4i);
`docs/QUEST_TRANSLATION_GUIDE.md`; `docs/PROBLEM_MEMORY.md`;
`docs/QUEST_FRICTION_ANALYSIS_LOG.md`.

User-visible result: задания больше не зовут нажать «Ответить»/«Дальше»;
подсказки и рассказы не выдают ответ; факты в соседних шагах не противоречат
друг другу; у Коперника — подлинные надписи постамента.

Data/API contract: без изменений схемы. `PATCH /api/quest-steps/<id>/` через
`sync-quest-to-prod.js` (поля title, location, story, task, hint,
answer_pattern), `PATCH /api/quest-finales/<quest id>/` (финалы novogrudok-crown
и minsk-teens-oktyabrskaya). Задание перевода: новые поля `source.steps[].answer_rule`
и `review.steps[].answer_rule` (добавление, обратно совместимо).

Platform impact: shared — текст рендерится одинаково на desktop web, mobile
web, Android и iOS; device gate не нужен.

Localization impact: all current locales — после правки источника переводы
RU→BE/UK/PL/EN становятся `stale` и перетягиваются
`npm run quest:translate -- prepare` (инкрементально).

Dependencies: действующий staff-токен для `--apply` и для борда (см. «Что
блокирует»); карточка `area=back` на дедуп городов — связанная, не блокирующая.

Fallback/mock policy: без моков; dry-run заливки против живого прода, чтение
анонимное.

Validation:
- `node scripts/scan-quest-prod-drift.js --source=<file>` по каждому файлу до
  правки — 0 расхождений (Астана/Туркестан — после `sync-quest-data-from-prod.js`);
- `for f in scripts/*quest-data.js; do node scripts/scan-quest-button-labels.js --source=$f; done`
  — 0 находок;
- `npx jest __tests__/scripts/scanQuestButtonLabels.test.ts __tests__/scripts/questTranslationTask.test.ts __tests__/scripts/questTranslateCli.test.ts __tests__/scripts/questTranslateChecks.test.ts`;
- `npm run check:fast` (hint-leak, surface-answer, city-walk, point-roles,
  anytext-minlen, button-labels по каждому изменённому data-файлу + eslint);
- `node scripts/sync-quest-to-prod.js --source-file=<file> --dry-run` по каждому
  изменённому файлу — PATCH-и печатаются, «шаги не доехали» нет;
- после `--apply`: `curl -s https://metravel.by/api/quests/by-quest-id/gomel-palace/`
  → шаг 349 содержит «нажми «Далее»», шаг 174 hint без «bel vedere».

Regression control: `__tests__/scripts/scanQuestButtonLabels.test.ts`,
`__tests__/scripts/questTranslationTask.test.ts`; скан в `check:fast`
(`run-fast-scope-checks.js`); правило 4i в `SKILL.md`; запись
`QUEST-BUTTON-LABEL-MISMATCH-001` в Problem Memory.

Done gate: все пункты Acceptance Criteria зелёные на проде; переводы
исправленных квестов перетянуты; черновики из `tasks/` удалены после импорта
на борд.

## Assignment

Primary owner: quest-editor
Support agents: quest-translator (перетянуть переводы), review-auditor /
code-review-gate (ревью diff), board-reviewer (приёмка на проде)

## Likely Files Or Areas

- `scripts/*-quest-data.js` (65 файлов, список — в `## Results`)
- `scripts/scan-quest-button-labels.js`, `__tests__/scripts/scanQuestButtonLabels.test.ts`
- `scripts/lib/questTranslation/task.js`, `__tests__/scripts/questTranslationTask.test.ts`
- `scripts/run-fast-scope-checks.js`, `package.json`
- `.claude/skills/metravel-quest/SKILL.md`, `docs/QUEST_TRANSLATION_GUIDE.md`,
  `docs/PROBLEM_MEMORY.md`, `docs/QUEST_FRICTION_ANALYSIS_LOG.md`

## Plan

1. Сверить каждый затрагиваемый data-файл с продом (`scan-quest-prod-drift.js`);
   разошедшиеся (Астана, Туркестан) из поезда исключить — им нужна своя
   карточка сведения.
2. Исправить перечисленные шаги в data-файлах точечными правками.
3. Написать `scan-quest-button-labels.js` с эталоном подписей из i18n, прогнать
   по каталогу, заменить «Ответить»/«Дальше»/«Завершить» на «Далее» во всех
   найденных шагах `any`; подключить скан к `check:fast`.
4. В конвейере перевода: кнопки мастера всегда в `ui_labels`; правило ответа у
   `range`/`approx`/`any_text`/`any_number`/`any` в `review-task`.
5. Зафиксировать правило 4i в `SKILL.md`, записи в Problem Memory и журнале
   аудита, обновить гайд переводчика.
6. Прогнать проверки из `Validation`, закоммитить явными путями, запушить.
7. С действующим токеном: `sync-quest-to-prod.js --apply` по каждому файлу,
   проверить GET-ом, перетянуть переводы `quest:translate prepare`.

Явно НЕ входит: дедуп quest-city (карточка `area=back`); глоссарий имён по
городам / сбор `accepted_names` из цитат переводов — отдельная карточка после
решения владельца (два варианта: ручной глоссарий в
`docs/QUEST_TRANSLATION_GUIDE.md` по городам либо сбор пар «ёлочки» источника ↔
перевода из опубликованных переводов того же города в `collectAcceptedNames`);
смена `range` у krakow-dragon 111 — скульптура Хромого семиглавая (сайт
Chromy 2.0, przewodnikpokrakowie.pl), диапазон 6–8 верен, граница счёта в
задании остаётся на усмотрение владельца; белорусский оригинал надписи на
памятном знаке Софье Гольшанской (767) — нужна фотография камня, в тексте
цитата заменена пересказом без кавычек.

## Validation

Сценарий для человека: открыть `https://metravel.by/quests` → Гомель → «дворец
Румянцевых и Паскевичей» → дойти до шага «☕ Портофино (по желанию)» → в
задании написано «нажми «Далее»», и под ним действительно одна кнопка «Далее».
Открыть шаг «Дворец Румянцевых и Паскевичей» → «Подсказка» не содержит
«bel vedere». Открыть Варшаву → шаг «Памятник Копернику» → в рассказе две
надписи постамента латиницей.

Команды — в `Task Contract → Validation`.

## Release Checklist

- [ ] Changed files are listed in `## Results`.
- [ ] New files created by this task are identified.
- [ ] Generated/cache/secret/local files are excluded.
- [ ] Task-scope files are staged when the user asks to prepare git.
- [ ] Skipped files and release blockers are recorded.

## Progress Log

- 2026-10-07: Created. Борд недоступен (MCP не стартует, REST 401) — черновик.
- 2026-10-07: drift-сверка 21 файла из списка владельца — 0 расхождений;
  Астана и Туркестан разошлись по всем полям (QUEST-CONTENT-SOURCE-DRIFT-001).
- 2026-10-07: точечные правки 21 квеста внесены в data-файлы; подсказки-заглушки
  (5 шагов) сняты; U+00AD вычищен в 3 файлах.
- 2026-10-07: `scan-quest-button-labels.js` написан; каталог: 61 шаг в 43
  файлах; «Ответить»/«Дальше»/«Завершить» → «Далее» в 58 шагах + 3 в
  Астане/Туркестане; повторный скан по всем 200 файлам — 0.
- 2026-10-07: `task.js`: кнопки мастера всегда в `ui_labels`; `answer_rule` +
  `accepted_answers` у счётных шагов в review-task; тесты добавлены.
- 2026-10-07: Астана и Туркестан НЕ тронуты и в заливку не идут. Проба
  сведения с продом (`sync-quest-data-from-prod.js`) перенесла 63 и 61 поле,
  7 и 4 поля (hint/lat/lng/answer_pattern) пришлось бы править вручную, а
  сведённый контент прода сразу упёрся в гейты, требующие авторского решения:
  4f без вердикта у `7-dom-ministerstv` («золотистых») и `9-akorda` (цвет
  купола), point-roles у `5-priyval-bulvar` (привал без «(по желанию)» в
  заголовке). На проде шаблона «Ответить» у этих квестов уже нет — он остался
  только в устаревших локальных копиях; локальный скан кнопок по ним красный
  ровно поэтому. Сведение — отдельная карточка QUEST-CONTENT-SOURCE-DRIFT-001.
- 2026-10-07: `node scripts/sync-quest-to-prod.js --source-file=<f> --dry-run` по
  всем изменённым data-файлам — код 0 у всех, «шаги не доехали» нет. Jest: `scanQuestButtonLabels`,
  `questTranslationTask`, `questTranslateCli`, `questTranslateChecks`,
  `scanQuestSkipPromise` — зелёные (136 тестов); eslint по изменённым
  скриптам и тестам — 0.
- 2026-10-07: `npm run check:fast` по всему diff — код 0 (65 data-файлов ×
  сканы достижимости, смешения алфавитов, составных написаний, 4a, 4f,
  point-roles, min_length, глубины историй, кнопок мастера + guards + eslint).
  По дороге 4a поймал собственную правку: `location` шага yerevan-ararat 73
  «Jazzve или любое кафе» стал утечкой после добавления варианта «jazzve» —
  подпись места заменена на «Любая кофейня в центре, где варят кофе
  по-армянски». `npm run audit:prompts` — passed; зеркало
  `.agents/skills/metravel-quest/SKILL.md` пересобрано `sync:agent-skills`.

## Results

Changed files: см. `git show --stat` коммита задачи (ветка
`claude/eloquent-ramanujan-7wsht9`).

Validation evidence: заполняется после прогона (`## Progress Log`).

Reviewer findings: —

Release notes: боевой `--apply` не выполнен — нет действующего токена в
сессии; переводы не перетянуты по той же причине.

Blockers: действующий staff-токен (см. «Что блокирует»).
