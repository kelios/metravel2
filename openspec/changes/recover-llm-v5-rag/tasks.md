# Tasks

Критерии — Task Contract #2751 и таблица `design.md`; delta specs пропущены
как tooling recovery (`skip_specs: true`), новых app-требований нет.

## 1. Планирование и замороженные входы

- [x] 1.1 Проверить proposal/design/tasks и выполнить `openspec validate recover-llm-v5-rag --strict`; сохранить результат до долгого обучения (2026-10-26: valid, zero deltas accepted).
- [ ] 1.2 Зафиксировать SHA256 старых оценок, 10 новых `cases.v5-holdout.jsonl`, fixtures, рубрик, pipeline, base/tokenizer и адаптера v4; проверить сохранение v4/v5 и готовность отдельного `v5-rag` output по manifest.
- [ ] 1.3 Подготовить воспроизводимые поручения исполнителю/судье через LLM skills и Claude→Codex/Grok adapters; проверить quick_validate, metadata audit и mirrors, отдельно записав чужие baseline failures.

## 2. Генератор и сборка данных

- [ ] 2.1 Реализовать `rag_answers` edition 5 с целями по видимым карточкам, компактными списками ≤3 и без вывода детской пригодности из `easy`; focused Jest подтверждает grounded targets и отрицательный контроль.
- [ ] 2.2 Добавить явные RU/BE/UK/PL/EN сценарии и EN/RU поездочные контрасты без копирования оценки; focused tests подтверждают баланс, короткий вывод и отсутствие holdout leakage.
- [ ] 2.3 Настроить отдельные mix/config `v5-rag` от v4 с S1 replay 0.4; `build_mix.py` и prepared manifests подтверждают реальные counts по set/split/locale, split isolation и полную token supervision без обрезания.
- [ ] 2.4 Обновить локальные инструкции и Problem Memory для механизма и постоянного контроля; сверить команды/пути с текущими scripts, не заявляя pass модели до runtime evidence.

## 3. Code review и handoff

- [ ] 3.1 Запустить узкие dataset/safety/schema checks и получить независимый review-and-fix полного task diff; исправления повторно проверены, code-review-gate pass зафиксирован.
- [ ] 3.2 Root коммитит только явные пути задачи и выполняет `PREFLIGHT_SKIP_E2E=1 git push origin main`; commit SHA и review evidence внесены в testing handoff #2751, чужие правки не включены.

## 4. Testing: локальный кандидат

- [ ] 4.1 Проверить owner процессов/locks и локальные ресурсы; отдельная короткая probe с тем же prepared snapshot завершилась с конечными train/validation loss без OOM/truncation, PID/log/config hashes сохранены.
- [ ] 4.2 Выполнить полный разрешённый локальный run `v5-rag` без параллельного GPU inference/export; зафиксировать успешный exit, фактические шаги и final adapter SHA256, сохранив прежние версии.
- [ ] 4.3 Выполнить отдельный `RUN=v5-rag` GGUF-экспорт; проверить целостность, SHA256, resolved identity и неизменность baseline artifacts.

## 5. Testing: независимое сравнение и решение

- [ ] 5.1 На одинаковом frozen pipeline собрать v4/candidate по bd01/bd07/bd11, BE ln02, UK ln03, mt03#1 ×3 и новым 10 holdouts ×3; сохранены все prompts/cards/raw/shown ответы и параметры, без отбора удачных повторов.
- [ ] 5.2 Независимый судья оценил каждый повтор: шесть обязательных regression случаев проходят каждый ≥2/3; ссылки, лимит ≤3, язык и отсутствие циклов/обрывов проверены по смыслу; новые holdouts отражены отдельно с counts.
- [ ] 5.3 Сравнить неизменённые S1/S2-срезы `eval.py`: osm_intents ≥9, wikivoyage ≥4, site ≥10, translations ≥8, toponyms ≥8; показатели и исходные ответы приложены, contaminated evidence явно отделено.
- [ ] 5.4 Проверить 100% обязательных off-topic/escalation случаев и frozen complex retention; судья перечисляет все нарушения условий и неподтверждённые заявления о доступности, разногласия с автопроверками объяснены.
- [ ] 5.5 Собрать таблицу v4→candidate по каждому gate и вынести go/no-go только из полного evidence; провал/пропуск сохраняет no-go и incumbent v4. Root записывает фактические acceptance/status результаты #2751; frontend deploy и promotion не подразумеваются.
- [ ] 5.6 Выполнить финальный `openspec validate recover-llm-v5-rag --strict` и `openspec validate --all`; изменения критериев не маскируют failed runtime, остаточные риски имеют точный recheck.

## Workflow follow-up

- Archive после фактического завершения всех обязательных checks и handoff; не архивировать из-за наличия нового GGUF или заполненных planning artifacts.
