# Tasks

- [x] 1. `utils/seoRoutes/staticRoutes.js` + `metadata.js` (+ jest: значения таблицы = сегодняшние STATIC_PAGES, билдер = набор тегов LazyInstantSEO).
- [x] 2. `generateMetadata` во всех web-листах `app/**` (статические, приватные noindex, legal, trips, app, 404, шаблоны динамических).
- [x] 3. `app/+html.tsx`: `{headNodes}` до critical-скрипта, снять дефолтный description.
- [x] 4. SSG-генератор (снят в #2766): STATIC_PAGES из общего модуля; тесты на таблицу/паритет — через модуль.
- [x] 5. `LazyInstantSEO`: дедуп не-`data-rh` дублей управляемых ключей после монтирования helmet.
- [x] 6. Снять helmet-мост из `patches/@expo+router-server+58.0.17.patch` (хунк RNW-стиля #2727 остаётся); `guard-html-meta-description` + проверка `<title>`.
- [ ] 7. Сборка до/после, `seo-signature` diff = без потерь; проверки статики (сняты в #2766), guards, lint, test:run.
- [x] 8. Docs: `docs/features/seo-static-metadata.md` (или раздел RULES «SEO ownership»), PROBLEM_MEMORY.
