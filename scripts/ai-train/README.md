# metravel-llm — собственная модель на корпусе сайта

Линия AI-ASSIST после решения владельца 17.10.2026: ответы посетителям даёт
наша модель, дообученная на статьях и квестах metravel.by, а не облачный API.
План и карточки — `docs/LOCAL_AI_ASSISTANT_PLAN.md` § 8 (#2462, #2463, #2458,
#2457, #2460).

## Окружение (Mac M1, 16 ГБ)

Внутренний диск Mac забит, поэтому всё живёт на APFS-образе на SSD T7.
exFAT напрямую не годится: AppleDouble-файлы `._*.py` ломают `transformers`.

```bash
hdiutil create -size 250g -fs APFS -type SPARSE -volname metravel-ai /Volumes/T7/metravel-ai.sparseimage
hdiutil attach /Volumes/T7/metravel-ai.sparseimage      # → /Volumes/metravel-ai
cd /Volumes/metravel-ai && uv venv venv --python 3.12 && uv pip install --python venv/bin/python mlx-lm huggingface_hub
venv/bin/hf download mlx-community/Qwen3.5-4B-MLX-4bit --local-dir models/Qwen3.5-4B-MLX-4bit
```

Раскладка `/Volumes/metravel-ai`: `models/` базы, `data/raw/` экспорт,
`data/sft/` датасет, `adapters/` результаты LoRA, `logs/` журналы и копии
конфигов каждого запуска.

## Шаги

1. Экспорт корпуса (только публичный прод-API, чтение, пауза между запросами):
   `python3 -I scripts/ai-train/export_corpus.py --out /Volumes/metravel-ai/data/raw`
   (`--quest-locales ru,pl,en` для переводов квестов; v0 — RU).
2. Датасет: `python3 -I scripts/ai-train/build_dataset.py --raw …/data/raw --out …/data/sft`
   → `train/valid/test.jsonl` в формате `messages` и `stats.json`. Виды
   примеров: карточки и разделы статей, плюсы/минусы/советы, подборки по
   стране/месяцу/дням, карточки/точки/финалы квестов, квесты по городу и
   стране, отказы по направлениям без материалов, «о сайте».
3. Обучение: `AI_HOME=/Volumes/metravel-ai RUN=v0 scripts/ai-train/train.sh`
   (конфиг `lora-qwen3.5-4b.yaml`: QLoRA rank 16 на 4-bit базе, 24 слоя,
   seq 2048, loss только по ответу). Долго — часы; журнал `logs/train-v0.log`,
   чекпоинты каждые 200 шагов в `adapters/metravel-llm-v0/`.
4. Проба: `venv/bin/python -m mlx_lm generate --model models/Qwen3.5-4B-MLX-4bit --adapter-path adapters/metravel-llm-v0 --prompt "Какие квесты есть в Гродно?"`.
5. Экспорт в GGUF и сервер — карточка #2463 (`mlx_lm fuse` на bf16-базу →
   `llama.cpp` → Q4_K_M → контейнер `llama-server`).

Данные и веса в репозиторий не попадают; секретов нет (API публичный).
