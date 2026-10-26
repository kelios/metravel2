# Tasks

Спайк (#2766):

- [x] 1. Маршрут `/travels/[param]` на `loader` + `useLoaderData` + `generateStaticParams` + per-slug `generateMetadata` в изолированном worktree (`spike-2766.diff`).
- [x] 2. SEO-подпись 12 статей против прод-HTML генератора: title/canonical/H1, покрытие текста, JSON-LD, вес.
- [x] 3. Гидрация (Playwright, 390/1440, маскировка `webdriver`), поиск расхождения MutationObserver и dev-SSR.
- [x] 4. Модель B: экспорт 12 / 350 / 1 400 путей, память и причина OOM по коду `@expo/cli`.
- [x] 5. Модель A: экспорт `output: "server"`, Node-адаптер `expo-server`, латентность/CPU/память, heap snapshot.
- [ ] 6. Решение владельца: A или B.

После решения (детализация — `design.md` → «План A» / «План B»; каждый пункт — отдельная карточка поезда):

- [ ] 7. A: фикс удержания памяти SSR (React Query на сервере без gc-таймеров), аудит модульных синглтонов; гейт 5 000 запросов при куче 384 МБ.
- [ ] 8. Экран статьи: урезанный payload loader'а, один запрос API на страницу, остров описания, JSON-LD Article+Breadcrumb+FAQ в теле, адаптивная критическая часть без JS-ветвления по ширине.
- [ ] 9. `area=back`: процесс SSR (A) или фолбэк промахов loaders (B); nginx-кеш и сброс по правке контента.
- [ ] 10. Переключение `/travels/*`, SEO-diff всех статей = без потерь, гидрация 390/768/1440 без #418, first-frame e2e; удаление статей из генератора.
- [ ] 11. Квесты, города/страны, локализованные пакеты квестов тем же циклом; снятие R1/R2 для перенесённых маршрутов.
- [ ] 12. Docs: `docs/features/seo-static-metadata.md`, `docs/PROBLEM_MEMORY.md`.
