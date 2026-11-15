## 1. Разбор

- [x] 1.1 Зона: `/ai/intent` и схема фильтра карты, подбор и отбор по месту, факты карточки, карточки с действиями #3295, вход в планировщик.
- [x] 1.2 Планировщик: форма создания точек не принимает; у точки маршрута есть номер дня (`dayNumber`, #1845); маршрут сохраняется полным `PUT /trips/planned/{id}/route/`.

## 2. Служба `/ai/plan`

- [x] 2.1 `scripts/ai-assist/planSchema.ts` — схема ответа модели и разбор.
- [x] 2.2 `scripts/ai-assist/planBuild.ts` — регион, часы из фактов, доводка плана модели, сборка кодом, `PLAN_MODEL_DEFAULT`.
- [x] 2.3 `scripts/ai-assist/plan.ts` — подсказка, конвейер, отказы, `trace` контура оценки.
- [x] 2.4 `scripts/ai-assist/app.ts` — кандидаты плана (`planCandidates`) и адрес `POST /ai/plan`.
- [x] 2.5 `config.ts`, `main.ts`, `api/aiAssist/policy.ts` — `AI_PLAN_DAILY_LIMIT`, `AI_PLAN_MODEL`, свой счётчик на IP.
- [x] 2.6 `scripts/ai-assist/demandLog.ts` — запись плана без IP.

## 3. Проба навыка (шаг 7)

- [x] 3.1 20 вопросов на пяти языках × 3 на модели продукта v7: первая подсказка — 6 из 54 по схеме, после уточнения подсказки — 30 из 54 (56 %); без чужого города — 54 из 54 до и после доводки (`.codex-temp/3298/probe-*.md`).
- [x] 3.2 Решение архитектора: схема принимает и отбрасывает `note` в дне; фраза модели посетителю не выводится. Повторная проба — 51 из 54 (94 %).
- [x] 3.3 Планы модели и кода рядом по 18 вопросам: `.codex-temp/3298/plans-side-by-side.md` — план модели беднее во всех 18.
- [x] 3.4 Решение архитектора: по умолчанию план собирает код (`PLAN_MODEL_DEFAULT = false`), путь модели — `AI_PLAN_MODEL=1`; правило включения — по схеме ≥ 90 % и содержание не беднее кодового; навык — задача круга обучения #3358.

## 4. Экран ассистента

- [x] 4.1 `api/aiAssist/planIntent.ts` — намерение и число дней на пяти языках.
- [x] 4.2 `api/aiAssist/planProvider.ts` — клиент `/ai/plan`: любой отказ — «плана нет».
- [x] 4.3 `useAssistantChat.ts` — план перед `/ai/ask`, отказ → обычный путь; `AssistantTurn.plan`.
- [x] 4.4 `AssistantPlanDays.tsx`, `AssistantTurnCard.tsx`, `AssistantSourceCards.tsx`, `assistantStyles.ts` — дни с карточками, время на материал, фраза о нехватке, «Открыть в планировщике».
- [x] 4.5 Строки `ask.plan*` в `i18n/locales/{ru,be,uk,pl,en}/static/ai_assist_static.ts`.

## 5. Планировщик

- [x] 5.0 Разведение модулей по весу страниц: `utils/tripPlanLinks.ts` (сборка ссылки, страница статьи) без импорта хранилища; `utils/tripPlanDraftIntake.ts` — приём точек только для формы.
- [x] 5.1 `utils/tripPlanDraft.ts` — черновик плана в хранилище, параметр точки материала, точки черновика → точки маршрута.
- [x] 5.2 `utils/tripPlanLinks.ts` — координаты в ссылке квеста (#3416 п.1), подстановка формы из черновика, точки из параметров ссылки.
- [x] 5.3 `app/(tabs)/trips/plan/create.tsx`, `TripCreateForm.tsx`, `TripRouteDraftNotice.tsx` — приём точек, сохранение маршрута после создания, повтор при сбое, возврат гостя к черновику.
- [x] 5.4 Строки `tripCreate.routeDraft*` в `i18n/locales/{ru,be,uk,pl,en}/static/trips_static.ts`.

## 6. Тесты и документация

- [x] 6.1 Служба: `__tests__/scripts/ai-assist/planSchema.test.ts`, `plan.test.ts`.
- [x] 6.2 Клиент и экран: `__tests__/api/aiAssist/planIntent.test.ts`, `__tests__/screens/assistant/assistantPlan.test.tsx`.
- [x] 6.3 Планировщик: `__tests__/utils/tripPlanDraft.test.ts`, `__tests__/app/tripCreateScreen.planDraft.test.tsx`, `__tests__/components/trips/tripCreateForm.test.tsx`.
- [x] 6.4 e2e-сценарий с моком `/ai/plan`: `e2e/ai-assistant-plan.spec.ts` (написан, не запускался).
- [x] 6.5 `docs/features/ai-assistant.md` — «План по дням (#3298)»; `services/ai-assist/README.md`; `docs/features/trips.md` — приём точек.
- [x] 6.6 Проверки: `npx tsc --noEmit -p .`, jest зон, `npm run test:i18n`, `npm run lint`, `npm run governance:verify`.

## 7. Стадия `testing`

- [ ] 7.1 Браузер 390 и 1280: «Спланируй два дня в Кракове» → два дня с карточками; «Открыть в планировщике» → поездка с точками по дням; «Спланируй пять дней в Лиде» → план короче и фраза о нехватке.
- [ ] 7.2 Прогон `e2e/ai-assistant-plan.spec.ts`.
- [ ] 7.3 Гость: вход и возврат в форму с черновиком.
- [ ] 7.4 Квест из ответа ассистента → «В план поездки» → точка в маршруте (#3416 п.1).
