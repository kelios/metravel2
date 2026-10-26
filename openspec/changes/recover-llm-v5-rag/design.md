# Design

## Context

Мотивация и границы — `proposal.md`. Подтверждённые механизмы edition 4 и
цепочка #2712 → #2731 → #2751 — `docs/PROBLEM_MEMORY.md`,
`AI-LLM-RAG-FORMAT-001`. Этот recovery требует design из-за нескольких
генераторов/оценочных контуров, GPU-памяти и риска переобучить оценку.

## Goals / Non-Goals

Goals: один воспроизводимый локальный кандидат `v5-rag`, независимый от
constraints-only v5; соответствие целей фактам карточек; проверяемая оценка
по всем gates #2751. Достижение порогов — результат эксперимента, не гарантия.

Non-Goals: изменение app-контрактов и модели продукта, дообучение на holdout,
устранение retrieval/guard-дефектов через шаблон ответа, backend/deploy scope.

## Decisions

1. **Исправить обучающую причину.** Использовать существующий `rag_answers.py`
   edition 5 и renderer карточек: target и source опираются на один видимый
   фрагмент, короткий label не добавляет новых фактов, лимит рекомендаций ≤3.
   Детская пригодность не выводится из `easy`; неизвестные параметры не
   превращаются в обещания. Языковые сценарии задаются явно, EN/RU поездочные
   вопросы получают позитивные контрасты. Отвергнуты app prompt patch и
   скрытие рекомендаций: они не устраняют неверные учебные цели.
2. **Начать от v4, сохранить остальные версии.** Reuse `build_mix.py`,
   `prepare_training_data.py`, `train.sh`, `export_gguf.sh` и текущие schema
   validators. `mixes/v5-rag.yaml`: s1/s2 дают replay, s3 учит
   `rag_answers`/`offtopic`; доля replay 0.4, с проверкой фактических S1 counts.
   `lora-qwen3.5-4b-v5-rag.yaml` продолжает v4 и пишет отдельный output.
   Продолжение от v5 отвергнуто: это добавило бы непроверенную регрессию и
   затруднило сравнение. Output probe, full adapter и GGUF не пересекаются.
3. **Сначала заморозить оценку.** До генерации training snapshot сохранить
   SHA256 10 новых `cases.v5-holdout.jsonl`, старых `cases*.jsonl`, fixtures,
   рубрик и `eval_prompts/`. Использовать прежние entity keys и split seed,
   replay только из train. Не переносить вопросы, их перефразы, карточки и
   эталонные ответы оценки в обучение; lexical guards дополняются ревью.
   Уже загрязнённый исторический срез отмечается явно, не называется holdout.
4. **Одинаковый pipeline для сравнения.** Сохранить SHA кода и хеши dirty
   inputs, model/tokenizer/adapter/GGUF identity, сервер и параметры генерации.
   Сравнивать v4 и `v5-rag` на одинаковых resolved prompts/cards; при изменении
   pipeline перегенерировать обе стороны. Автопроверки не заменяют смыслового
   судью; raw и shown ответы сохраняются раздельно для каждого повтора.
5. **Разделить исполнение и судью.** Reuse новые skills
   `metravel-llm-training`/`evaluation`, роли `llm-trainer`/`llm-judge`.
   Reviewer получает полный task diff и static/unit evidence. После review и
   commit/push handoff root выполняет testing: проба с конечными loss,
   полный run, экспорт и независимая оценка без подсказки желаемого победителя.
   Не запускать inference/export параллельно trainer; не останавливать чужие
   GPU-процессы. Locks/checkpoint и отсутствие paid/cloud — по operations §3.4.

## Ownership and Data Contract

- Generator owner: `scripts/ai-train/sets/rag_answers.py`,
  `__tests__/scripts/ai-train-rag-answers.test.ts`.
- Coordinator: отдельные `mixes/v5-rag.yaml`, LoRA config, frozen holdout,
  candidate artifacts и evidence; workflow owner — новые LLM skills/roles.
- Record schema остаётся `sets/common.py`: прежние messages/key/id/metadata;
  split по entity/scenario key, фактический состав и происхождение в manifests.
  Полный chat-template пример, включая цель, укладывается в token budget;
  oversized примеры исключаются целиком, условия и цель не обрезаются.
- API/auth/platform split: none — app transport и endpoints не меняются,
  local model test через loopback. Backend остаётся read-only dependency и
  не требуется для fixed-card inference. Ошибка подготовки, OOM, NaN или
  неполный GGUF останавливают этап с причиной и checkpoint, не с фиктивным pass.

## Validation Matrix and Acceptance

| Слой / поверхность | Evidence и критерий |
| --- | --- |
| Generator, RU/BE/UK/PL/EN | Focused Jest `ai-train-rag-answers`, safety/schema regressions; видимые факты, семейность, баланс, короткие списки и лимит 3; build/prepared manifests и отсутствие утечек |
| Workflow metadata | `audit:prompts`, quick_validate каждого нового skill, generated mirrors; чужой baseline failure фиксируется отдельно, не превращается в pass |
| Local training | Отдельная короткая проба без OOM/NaN/truncation; полный run с успешным exit и final adapter; записанные config/data/tokenizer hashes |
| Export | Отдельный `RUN=v5-rag`, завершённый GGUF и проверенный SHA256, прежние v4/v5 не изменились |
| Assistant regression | bd01, bd07, bd11, BE ln02, UK ln03, mt03#1: каждый ≥2/3 повторов; по теме, ≤3 рекомендаций, нужные ссылки, без циклов/обрывов; independent judge |
| New holdout, all locales | Все 10 замороженных случаев ×3; raw/shown prompts/cards/answers, каждый verdict и counts; результаты отдельно от известных вопросов |
| Prior S1/S2 | `eval.py`: osm_intents ≥9, wikivoyage ≥4; site ≥10, translations ≥8, toponyms ≥8; сравнение с frozen v3/v4 evidence на том же наборе |
| Refusal / escalation | 100% в предусмотренных контрактом случаях; ни один поездочный вопрос не получает ложный отказ «не по теме» |
| Complex retention | Тот же frozen complex набор; по каждому условию/неподтверждённой доступности отдельные v4→candidate результаты и no-go для незакрытого обязательного ограничения |
| Desktop/mobile web, Android, iOS | App code none: повторять shared inference по OS/viewport не требуется. Browser/backend нужны только если приёмка требует реального integration flow; он выполняется в testing на назначенном target |

Команды сбора: `ai:assistant:quality` для fixed-card model-only, `eval.py` для
dataset slices; `ai:assistant:eval` при проверке retrieval/screen contract.
Повторы и судья не заменяются выбором лучшего ответа. Все обязательные
thresholds проверяются раздельно; missing/failed gate — **no-go**, даже при
росте среднего балла. Никакого автоматического promotion.

## Risks / Trade-offs

- [Малый/известный набор завышает вывод] → отдельный замороженный holdout,
  ×3, прозрачные знаменатели и независимый судья; не обобщать на весь каталог.
- [Replay не удержит S1 либо ухудшит RAG] → проверка фактического состава и
  каждого регрессионного threshold; не объявлять обучение успешным по loss.
- [Языковой лимит даёт обрыв вместо краткости] → короткие полные targets и
  оценка raw output, не расширение max_tokens ради прохождения проверки.
- [Совпавшие факты с неверной связью] → судья проверяет все условия и выбор
  объектов, не только наличие слов; доступность отмечается отдельно.
- [Память/чужая операция] → операции последовательно, явные owner/locks,
  короткая проба и сохранённый checkpoint перед полным run.
- SEO, UI accessibility semantics/focus, Core Web Vitals/bundle, WebView,
  analytics: none — соответствующие app paths не меняются. Security scope —
  целостность local inputs, отсутствие secrets в evidence и утечки holdout.

## Migration Plan

Миграций продукта нет. Сначала review/freeze, затем отдельные prepared данные,
probe/full artifacts и оценка. Rollback: остановить только свой процесс,
сохранить failed evidence, оставить incumbent v4; не удалять v4/v5 и не
перезаписывать кандидат повторным запуском. Новый цикл получает новую identity
и не использует результаты текущего holdout как training targets.

Open questions: нет материальных неопределённостей в scope; фактические
метрики, расход памяти и время обучения устанавливаются исполнением.
