# #2356: сохранённая подготовка backend PDF

Дата: 2026-10-10. Неприменённый архив разработки, не действующий контракт.
Пользователь поручил сохранить сделанное в Git, запушить и остановиться.

Соседний `2356-backend-wip.patch` содержит 8 task-owned путей backend,
base `083d45cc264f458d8399aeb7d18ec8b2c29d8daa` (master), 24280 байт,
SHA-256 `824376d41ebbc2829f46552b791b0ef5170e02fb82d5317d8ff50a9f36bacf89`. Конечные файлы побайтно совпали с принятым handoff.
Патч сохранён во frontend-репозитории; backend working tree не изменён,
backend master не коммитился и не пушился этой операцией.

## Что сохранено и что осталось

OpenSpec add-canonical-book-pdf-worker и подготовка явного pids/resource profile:
штатные defaults 256 MiB / CPU0.25 / 64 pids сохранены, кандидат 1 GiB / 128 pids
требует отдельной настоящей проверки. Backend feature implementation,
серверный PDF/certificate/ticket и новый rollout отсутствуют. B1/B2 уже приняты
своими исполнителями; это не приёмка B3. Capability/readiness не включены.

Не применённый к production черновик не проходил новый независимый backend
review, полный backend gate или runtime acceptance. Архивный review и проверка
применения патча подтверждают сохранность, а не корректность реализации.
Чужой `openspec/changes/add-durable-book-export-queue/` не включён и не изменён.

## Возобновление

После нового поручения согласовать единственного владельца #2356 и проверить
backend master/status. Перед применением сохранить чужие изменения и сверить
точный base и хеши. Продолжение проходит backend AGENTS/CLAUDE и профильный
workflow: strict OpenSpec, implementation, tests, review, canonical rollout,
настоящая AMD64 capacity и PDF/API acceptance. F1 #2354 остаётся зависимостью;
frontend WIP сохранён в [соседнем handoff](2352-planner-wip.md).
Не объявлять #2352/#2356 done и не включать большую книгу до полного Done gate.

## Точный снимок

| Путь | SHA-256 конечного файла | Байты |
| --- | --- | ---: |
| `docker-compose.book-export-worker.yaml` | `57ae08651eace5afc74eb6e94edda9b9ee35ea8c13e661629babd97421050959` | 3470 |
| `docs/book-exports/durable-worker.md` | `37d7d086e2f000f783146e9afee9b91655dc7ffa8e3a19ce3aecb85cfb3f7fdd` | 12329 |
| `openspec/changes/add-canonical-book-pdf-worker/.openspec.yaml` | `e61703315c59969805e021ec521ca189369aaf8ea902d52c5e39c7fbc603598f` | 40 |
| `openspec/changes/add-canonical-book-pdf-worker/README.md` | `f45295a4ef709269cfaa7faaf49658e3f2190e1113b1ee23d1ca7a3d2ae902ce` | 163 |
| `openspec/changes/add-canonical-book-pdf-worker/design.md` | `d1a923e257bb2cd381ec226a4bc7018c2669e67f82bdfe9438bf3ecc0c753250` | 9153 |
| `openspec/changes/add-canonical-book-pdf-worker/proposal.md` | `831021703b32b6cfdc22227673636ab1841790229abc4d195e1edc70ba125402` | 2803 |
| `openspec/changes/add-canonical-book-pdf-worker/specs/exports/book-pdf-publication/spec.md` | `be084be6303d45ab3df42da0f2c6c0e143dea11ea84174611f54b71184c671a8` | 4945 |
| `openspec/changes/add-canonical-book-pdf-worker/tasks.md` | `75b1749ddffb4c75ec2447c6ec5ab1b865c098f272221bc8e1fd493ff0a24985` | 3714 |
