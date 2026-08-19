# MeTravel — growth strategy

Актуализировано: 2026-07-15. Горизонт текущего цикла: 2026-06-08 —
2026-12-08.

Этот документ хранит стратегию и cadence, но не backlog. Конкретные frontend и
backend работы, owners, dependencies и Done evidence находятся только на MCP task
board по `docs/TASK_BOARD_MCP.md`.

## Цель цикла

Главная цель — устойчиво увеличить organic discovery и довести измерение
воронок до состояния, в котором решения о монетизации опираются на данные.
Исходный ориентир цикла — рост organic traffic в 5–10 раз относительно baseline
2026-06-08; это цель, а не подтверждённый результат.

Приоритеты:

1. индексируемость и качество search snippets;
2. production performance ключевых landing/travel pages;
3. полезный travel/article/quest content;
4. регистрация и создание контента без ложных success states;
5. измеряемые affiliate/lead/product funnels;
6. монетизация — только тематические рекламные и партнёрские интеграции,
   после достаточного трафика и корректной аналитики (см. «Monetization»).

## Источники данных

| Источник | Что использовать |
| --- | --- |
| `docs/ANALYTICS_AUDIT_2026-07.md` | snapshot GA4/GSC/Yandex от 2026-07-02 |
| `docs/SEO_AUDIT_2026-08-08.md` | текущий indexing/search snapshot от 2026-08-08 |
| `docs/SEO_AUDIT_2026-07-11.md`, `2026-07-18.md`, `2026-07-27.md` | предыдущие срезы, только как история |
| `docs/ARTICLE_ATTENTION_LOG.md` | append-only article attention cycles |
| `docs/QUEST_DEMAND_LOG.md` | append-only quest demand cycles |
| MCP task board | текущие работы, blockers и Done evidence |
| real production URL/API | fresh runtime/performance evidence |

Любое число сопровождается source и абсолютным окном измерения. Dated audit не
называется «текущим» без нового замера. Отсутствующие события или доступы
фиксируются как instrumentation gap, а не заменяются оценкой.

## Monthly review

Ревью проводится около 8-го числа каждого месяца:

- GSC: clicks, impressions, CTR, average position, indexed/excluded URLs;
- GA4/Yandex: users, sessions, engagement и landing pages;
- product funnels: registration, auth completion, travel/article/quest create
  start → success;
- content: новые и обновлённые pages, search demand, attention cycle outcomes;
- performance: fresh production measurements для representative URLs;
- monetization: affiliate clicks/orders/commission и другие подтверждённые
  conversions;
- measurement gaps, backend blockers и следующий месячный focus.

Ревью обновляет существующие dated audit/log документы только если их формат
предназначен для append. Новый snapshot создаётся лишь когда старый нельзя
корректно продолжить; он получает дату в имени и явно указывается в
`docs/INDEX.md`.

## Workstreams

### SEO and indexing

- sitemap/canonical/robots/metadata проверяются по реальному production URL;
- страницы с impressions и низким CTR приоритизируются по свежему GSC окну;
- IndexNow и manual submission — operational backup, а не замена исправлению
  indexability;
- frontend не генерирует production `sitemap.xml`: owner — backend.

### Performance

- Lighthouse запускается по production build или `https://metravel.by`;
- thresholds и measurement method берутся из config/scripts, не из старых
  отчётов;
- travel hero/details обязаны сохранять slider и performance contracts из
  `docs/RULES.md` и `docs/TRAVEL_PERFORMANCE_REFACTOR.md`;
- byte budgets и runtime metrics считаются разными gates.

### Content and demand

- новые темы выбираются по search demand, editorial value и способности дать
  уникальный полезный маршрут;
- article/quest operational outcomes пишутся в соответствующие append-only logs;
- creative article/quest text меняется только после отдельного подтверждения
  пользователя;
- generated media не подменяет реальные/photorealistic production travel media
  стилизованной заглушкой.

### Acquisition and conversion

- для каждого канала фиксируются landing URL, UTM convention, event/goal и
  success criterion;
- external links проходят через централизованные helpers;
- registration/auth/content creation оцениваются как end-to-end funnel;
- backend-dependent form/mutation без endpoint не получает fake-success
  fallback.

### Retention

- subscriptions, favorites/history, travel statuses, achievements и social trips
  оцениваются по реальному повторному использованию;
- dev mocks и UI presence не считаются adoption;
- privacy/trust/contact flows требуют отдельного runtime и security evidence.

### Monetization

Продуктовая рамка зафиксирована владельцем 2026-08-18 и не является открытым
вопросом:

- **продукт бесплатный для пользователя** — статьи, карта, прохождение квестов
  и печатные сценарии остаются бесплатными без лимитов и без premium-уровней;
- **проект не готовится к продаже** — exit, pre-sale подготовка и оценка бизнеса
  не являются целями и не влияют на приоритеты;
- **единственная планируемая модель дохода — тематические рекламные интеграции**:
  партнёрские блоки (жильё, экскурсии, снаряжение) и размеченные sponsored
  размещения, релевантные теме конкретной страницы;
- **фокус работы — трафик и пользователи**, а не выручка: доход рассматривается
  как производная от аудитории и не ставится целью спринта.

Что из этого следует для планирования:

- прямые продажи пользователю (платный доступ, платный печатный квест-бук,
  подписка, premium-шаблоны экспорта, B2B-пакеты школам и тимбилдингам) вне
  текущего плана. Такие задачи живут в спринте «Монетизация» со статусом
  `backlog` и не берутся в работу без отдельного решения владельца;
- донаты и кнопки «поддержать проект» — туда же: это не рекламная интеграция;
- affiliate и sponsored поверхности требуют измерения: показы, клики, заказы,
  комиссия за окно и stop/go по каждому блоку. Поверхность без доказанных
  кликов снимается — она занимает место и стоит доверия;
- ни один рекламный блок не имеет права ухудшать метрики страницы (LCP,
  читаемость, конверсия в старт квеста); при конфликте выигрывает контент;
- маркировка рекламы и партнёрских ссылок обязательна, внешние ссылки — только
  через централизованные helpers.

Текущий подтверждённый baseline: affiliate orders/commission не доказаны. До
свежего измерения revenue нельзя представлять как положительный результат.

## Baseline воронки — 2026-08-18 (спринт 25)

Источник: GA4 property 362328641, `npm run stats:ga4 -- --events --days 30`
(окно 19.07–18.08.2026), 49 имён событий. GA4 недосчитывает трафик (consent +
адблоки), поэтому абсолютные значения — нижняя граница; соотношения внутри
воронки корректны.

Общее за 30 дней: 470 active users, 799 сессий, 2 201 просмотр, средняя сессия
5:59, bounce 31%.

### Квесты

| Шаг | Событий | Пользователей |
| --- | ---: | ---: |
| `quest_card_click` | 26 | 21 |
| `quest_start` | 116 | 45 |
| `quest_point_done` | 181 | 45 |
| `quest_finish` | **7** | **6** |
| `quest_guest_gate_view` | 26 | 15 |
| `quest_guest_gate_login_click` | 8 | 7 |
| `quest_guest_gate_register_click` | 6 | 6 |
| `quest_guest_progress_migrated` | 8 | 7 |

Главное число: **6% стартов доходят до финала** (7 `quest_finish` на 116
`quest_start`) при длине маршрута 7–10 точек. Поправки эта величина не требует:
`quest_finish` intro не касался.

Пройденных точек на старт сырой замер даёт 1,56 (181/116), но величина завышена:
в `quest_point_done` попадал intro-шаг. С поправкой среднее порядка **0,56 точки
на старт**, а из него следует: **не меньше 44% стартов не берут ни одной точки
маршрута и не меньше 72% берут меньше двух**. То есть обрыв стоит в самом начале
маршрута — не позже второй точки, а не в середине. На каком именно шаге он
максимален, из среднего не определяется: считать после выката #1498 по
`quest_step_view`. Порядок поправки и её границы — в «Вердикте INV2-18» ниже.

Оговорка о `quest_card_click`: 26 кликов при 116 стартах — событие покрывает не
все входы в квест (прямые заходы из поиска на страницу квеста мимо карточки в
каталоге его не дают), поэтому оно не годится как верх воронки и вывод выше
строится только на паре `quest_start` → `quest_point_done`.

Гостевой гейт работает: из 15 увидевших 7 нажали вход, 6 — регистрацию, 7
перенесли прогресс в аккаунт.

### Регистрация

| Шаг | Событий | Пользователей |
| --- | ---: | ---: |
| `register_cta_impression` | 1 | 1 |
| `cta_register_click` | 13 | 13 |
| `registration_view` | 14 | 14 |
| `registration_submit` | 8 | 8 |
| `registration_complete` | **8** | **8** |
| `registration_error` | 1 | 1 |
| `login_success` | 12 | 8 |

Вывод, опровергающий рабочую гипотезу: форма регистрации **конвертирует 57%**
(8 complete из 14 view) — она не сломана. Сломан вход в неё: до формы доходит
14 человек в месяц при 470 активных. Работать надо над поводом и точками входа,
а не над самой формой.

### Создание контента

| Шаг | Событий | Пользователей |
| --- | ---: | ---: |
| `content_create_cta_click` | 2 | 2 |
| `route_create_started` | 2 | 1 |
| `wizard_step_view` | 11 | 2 |
| `travel_publish` | **0** | **0** |

`travel_publish` — это **не** instrumentation gap: эмиттер
`trackRouteCreatePublishSucceeded` живёт в `components/travel/useTravelPublishModeration.ts`
с 19.07.2026, то есть работал всё окно. Ноль означает ровно то, что написано: за
30 дней ни одно путешествие не опубликовано. UGC-канал стоит.

### Монетизация

| Событие | Событий | Пользователей |
| --- | ---: | ---: |
| `Affiliate_Impression` | 46 | 27 |
| `Affiliate_Click` | **2** | **1** |

46 показов партнёрского блока за 30 дней — это на порядок меньше, чем страниц с
блоком: поверхность почти нигде не рендерится (страновой гейт Belkraj). Решение
stop/go по блокам — задача INV2-12.

### Статус событий воронки

| Событие | Статус |
| --- | --- |
| `quest_start`, `quest_point_done`, `quest_finish`, `quest_card_click` | работает; в `quest_point_done` сидит intro-шаг — исключён кодом 19.08.2026, но в счётчике останется до прод-выката #1498, см. поправку в разделе «Квесты» |
| `quest_guest_gate_view/login_click/register_click`, `quest_guest_progress_migrated` | работает |
| `register_cta_impression`, `cta_register_click`, `registration_view/submit/complete/error`, `login_success` | работает |
| `favorite_add` (9 / 2 польз.), `favorite_intent_guest` (10 / 7) | работает |
| `Affiliate_Impression`, `Affiliate_Click` | работает |
| `travel_publish` | эмиттер есть с 19.07, событий ноль → ноль публикаций, не гэп |
| `quest_skip_stuck_step`, `quest_finish_early`, `quest_completion_credited` | эмиттеры шипнуты 17–18.08 — в окно попадают часы, отсутствие ожидаемо |
| `quest_card_impression` | эмиттер шипнут 17.07 (`QuestForCityCard.tsx:92`) и работал всё окно, но ноль показов при 26 кликах карточек — **починено 19.08.2026**, см. вердикт ниже |
| `quest_step_view`, `quest_answer_submit`, `quest_hint` | эмиттеров не было; **добавлены 19.08.2026** (INV2-18) |
| `app_download_click` | цель Метрики «Скачали приложение» (ID 599654242) заведена 19.08.2026; эмиттер добавлен тем же днём на трёх поверхностях (`HomeAppPromoSection`, `AppInstallBar`, лендинг `/app`) — считает клики до Google Play, deploy-gated: до прод-деплоя нулей ожидать нормально |

### Вердикт INV2-18 по нулевым событиям (19.08.2026)

**`quest_card_impression` — был сломан механизм показа, починено.**
`useTrackedImpression` ставил `IntersectionObserver` в ref-колбэке (фаза
коммита), а эффект «сбросить состояние при смене ключа» на первом же проходе —
то есть сразу после монтирования — рвал эту подписку безусловно. Ref-колбэк
после этого повторно не вызывается, взводить наблюдатель было некому, и показ
не фиксировался никогда. Отсюда ноль `quest_card_impression` при 26 кликах и
единственный `register_cta_impression` за 30 дней: дефект общий для всех
поверхностей хука (карточка квеста, `ArticleNextStepSection`,
`ArticleActivationCtaSection`, `TravelRegisterCtaSection`). Регрессия закрыта
тестом `__tests__/hooks/useTrackedImpression.test.tsx` (проверено: падает на
старом коде).

**`quest_completion_credited` — ноль корректен, эмиттер моложе окна.**
Событие появилось в коде 18.08.2026 (коммит `ab711bd1`), то есть в последние
сутки окна 19.07–18.08 — та же категория, что `quest_skip_stuck_step` и
`quest_finish_early`. Инструментального дефекта нет: условие срабатывания —
`questFinished && stepsMissingForCompletion === 0`, то есть любое засчитанное
прохождение, а не только возврат с частичного финала. После деплоя счётчик
обязан сходиться с `quest_finish` при `partial: false`; если разойдётся —
это уже про политику зачёта (#1443), а не про трекер.

**Побочная находка: `quest_point_done` завышен intro-шагом.**
Intro проходит тем же обработчиком ответа, что и точки маршрута, и слал
`quest_point_done` со `step_index: -1`. Значит часть из 181 события за окно —
не пройденные точки, и «1,56 точки на старт» завышено. Порядок поправки — около
одного intro-события на старт (~116 из 181), после неё среднее ≈0,56 точки на
старт: воронка хуже, чем читалась при первом замере.

Точное число intro-событий задним числом не восстанавливается, и ошибка
двусторонняя. Вниз: сессия, возобновлённая с середины квеста, монтируется сразу
на реальной точке (`applyProgressState` восстанавливает `currentIndex` из
снапшота) — `quest_start` уходит, intro-события в такой сессии нет. Вверх:
intro никогда не считается пройденным (`isPassed` его исключает), поэтому
повторный заход на него даёт лишнее intro-событие без второго `quest_start`.
Однозначно только направление поправки: реальных точек меньше 181.

**Ни точная доля нулевых стартов, ни номер шага-обрыва из среднего не выводятся.**
Одно и то же среднее совместимо и с 44%, и с 90% нулевых стартов; распределение
по шагам за окно не измерялось ничем — `quest_step_view` заведён только
19.08.2026, а `--events` даёт разбивку лишь по имени события. Контрпример на
публикуемых величинах: 51 старт с нулём точек плюс 65 стартов ровно с одной
точкой дают то же среднее ≈0,56, но обрыв на второй точке (56%) там больше
обрыва на первой (44%). Считать и долю, и номер шага — после выката #1498 по
`quest_step_view`.

Из среднего следуют только нижние границы (неравенство Маркова: доля стартов,
взявших не меньше `k` точек, не превышает `среднее / k`). При ≈0,56: не меньше
**44%** стартов без единой точки, не меньше **72%** — меньше двух точек, не
меньше **81%** — меньше трёх. Отсюда вывод: при среднем ≈0,56 обрыв укладывается
в первые одну-две точки маршрута. Вывод привязан именно к этой оценке —
поскольку ошибка среднего двусторонняя (см. выше), вместе с ней поедут и
границы: например при среднем ≈1,0 те же неравенства пускают обрыв уже на
третью точку.

Intro исключён из события 19.08.2026 (`QuestWizard.tsx`, условие
`currentRealIndex >= 0`), но граница сравнимости счётчика — **дата прод-выката
#1498**, а не дата коммита: пока правка не на проде, intro продолжает
считаться.

Три новых события (`quest_step_view`, `quest_answer_submit`, `quest_hint`)
отвечают на вопрос, на каком именно вопросе ломается прохождение. Проверка —
`npm run stats:ga4 -- --events --days 7` через 7 дней после деплоя.

## Security and access

Analytics/search credentials хранятся только в gitignored secret storage и
используются project-owned scripts/skills. Токены, service-account JSON и
`.env.e2e` не выводятся в документацию, логи, screenshots или commits.

## Decision record

После monthly review фиксируются:

- период и источники;
- что изменилось относительно предыдущего окна;
- какие гипотезы подтверждены или отклонены;
- какие instrumentation gaps мешают решению;
- ссылки на созданные/обновлённые board tasks;
- дата следующего review.

Исторические разовые performance/task logs из старой версии этого файла удалены:
актуальные технические контракты живут в профильных docs, а работа — на board.
