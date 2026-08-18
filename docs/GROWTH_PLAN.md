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
(окно 19.07–18.08.2026). GA4 недосчитывает трафик (consent + адблоки), поэтому
абсолютные значения — нижняя граница; соотношения внутри воронки корректны.

Общее за 30 дней: 470 active users, 799 сессий, 2 201 просмотр, средняя сессия
5:59, bounce 31%.

### Квесты

| Шаг | Событий | Пользователей |
| --- | ---: | ---: |
| `quest_start` | 116 | 45 |
| `quest_point_done` | 181 | 45 |
| `quest_finish` | **7** | **6** |
| `quest_guest_gate_view` | 26 | 15 |
| `quest_guest_progress_migrated` | 8 | 7 |

Главное число: **1,56 пройденной точки на один старт** (181/116) при длине
маршрута 7–10 точек, и **6% стартов доходят до финала** (7 из 116). Обрыв
происходит не в середине маршрута, а на первой-второй точке: люди открывают
квест, отвечают один раз и уходят. Это меняет приоритет — сначала первая точка
и понятность «что делать дальше», потом всё остальное.

### Регистрация

| Шаг | Событий | Пользователей |
| --- | ---: | ---: |
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

### Монетизация

`Affiliate_Click` — **2 события / 1 пользователь за 30 дней**. Единственная
выбранная модель дохода на текущем трафике даёт околонулевой результат; решение
stop/go по блокам — задача INV2-12.

### Instrumentation gaps

Не долетает ни одного события: `quest_answer_submit`, `quest_hint`,
`quest_skip`, `quest_step_view`, `travel_publish`. Пока их нет, невозможно
сказать, на каком именно вопросе ломается прохождение и как часто берут
подсказку. Заведено отдельной задачей.

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
