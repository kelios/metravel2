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
6. монетизация только после достаточного трафика и корректной аналитики.

## Источники данных

| Источник | Что использовать |
| --- | --- |
| `docs/ANALYTICS_AUDIT_2026-07.md` | snapshot GA4/GSC/Yandex от 2026-07-02 |
| `docs/SEO_AUDIT_2026-07-11.md` | indexing/search snapshot от 2026-07-11 |
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

Текущий подтверждённый baseline из исходного плана: affiliate orders/commission
не были доказаны. До свежего измерения revenue нельзя представлять как
положительный результат.

Допустимые направления исследования:

- affiliate conversion;
- lead/email capture после появления server contract;
- sponsored content/placements с маркировкой;
- author tools или premium export после подтверждения спроса.

Каждое направление получает owner, legal/privacy check, instrumentation и
stop/go criterion на MCP task board до реализации.

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
