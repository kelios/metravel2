# Бэкап production-базы metravel.by

Актуализировано: 2026-08-05 (цифры по скрипту сняты с прода в этот день,
остальные — 2026-08-04).

## TL;DR

- **Автоматических бэкапов БД на проде по-прежнему нет.** Cron-задачи,
  S3-выгрузки и лога бэкапа не существует — это задача борда **#1247** (нужен
  sudo владельца сервера).
- **Штатный скрипт на прод-хосте починен и проверен реальным прогоном 05.08.2026**
  (#1246): дамп снимается напрямую через `docker exec`, без compose. Первый
  успешный прогон — `metravel-postgres-20260805T122720Z.sql.gz`, 52 328 299 байт,
  14 с, `gzip -t` OK, exit 0. То есть включать cron уже можно.
- **Свежая логическая копия на сервере одна и снята вручную** —
  `/home/sx3/db-backups/metravel-postgres-20260805T122720Z.sql.gz` (05.08.2026).
  Она не обновляется сама: без #1247 завтра снова будет устаревать.
- **До неё единственной копией была холодная от 17.11.2025**:
  `/home/sx3/pg_dump_17_11_2025/postgis/data`, 372.9 МиБ, владелец `root`.
  Несмотря на имя, это не логический дамп, а холодная копия каталога данных
  PostgreSQL 17 (внутри `PG_VERSION`, `base/`, `pg_wal/`, `postmaster.pid`).
- **Свежий дамп снимается одной командой** `npm run db:backup:prod` — ~16 секунд,
  ~44 МиБ `.sql.gz` в `backup/` в корне репозитория, с проверкой целостности; см.
  [Как снять бэкап прямо сейчас](#как-снять-бэкап-прямо-сейчас).

## Что где лежит

| Объект | Путь / расположение | Состояние на 2026-08-05 |
| --- | --- | --- |
| Живая БД | контейнер `metravel_metravel-gis_1`, образ `postgis/postgis:17-3.5`, база `metravel`, пользователь `metravel` | 311 MB (`pg_database_size`) |
| Каталог данных живой БД | bind-mount `/home/sx3/metravel/deploy/prod/postgis/data` (в compose — `./deploy/prod/postgis/data`) | 431.9 МиБ |
| Свежая логическая копия | `/home/sx3/db-backups/metravel-postgres-20260805T122720Z.sql.gz` | 05.08.2026, 52 328 299 Б, снята вручную и не обновляется |
| Старая холодная копия | `/home/sx3/pg_dump_17_11_2025/postgis/data` | файлы от **17.11.2025**, 372.9 МиБ, `root:root` |
| Локальные дампы скрипта (`BACKUP_DIR`) | `/home/sx3/metravel/deploy/prod/backups/` | каталога не существует (проверочный прогон 05.08.2026 писал в `/home/sx3/db-backups/`) |
| Дампы в S3 | не настроено: `aws` CLI не установлен, `~/.aws` нет | — |
| Диск под всё это | `/dev/sda1` → `/` | 15 ГБ, занято 73 %, свободно ~3.9 ГБ (05.08.2026) |

Как проверялось: поиск по всему корню хоста, включая root-owned каталоги
(`docker run --rm -v /:/host:ro alpine find /host -xdev … -size +1M`), не нашёл
ни одного `*.sql`, `*.sql.gz`, `*.dump` или `*backup*` крупнее 1 МиБ. То есть на
тот момент других копий базы на сервере не было; единственная появившаяся с тех
пор — ручной дамп от 05.08.2026 в строке выше.

Медиа — отдельная история и к БД отношения не имеет: картинки живут в S3-бакете
`metravelprod` (eu-north-1), их полная локальная копия снимается скриптом
[`scripts/backup_media_storage.py`](../scripts/backup_media_storage.py).

## Как снять бэкап прямо сейчас

### Канонический путь: `npm run db:backup:prod`

```bash
npm run db:backup:prod
```

Скрипт [`scripts/backup-prod-db.sh`](../scripts/backup-prod-db.sh) снимает дамп
потоком: `pg_dump` работает внутри прод-контейнера, сжатие идёт уже на локальной
машине, **на прод-диск ничего не пишется** (там свободно ~2.6 ГБ). Результат —
`backup/metravel-postgres-<UTC>.sql.gz` в корне репозитория, права `600`.
Хранится только последний архив: предыдущий удаляется сразу после того, как
новый прошёл все проверки.

**Каталог `backup/` закрыт в `.gitignore` и должен таким остаться.** Внутри
дампа персональные данные пользователей, а репозиторий публичный
(`github.com/kelios/metravel2`) — плюс в этом checkout работает сторонний
авто-коммит, забирающий всё дерево. Поэтому скрипт перед записью проверяет
`git check-ignore` и отказывается класть дамп в каталог, который git не
игнорирует.

Что проверяется до того, как файл получит финальное имя (пишется в `.part` и
переименовывается только после всех проверок):

- коды возврата **обеих** половин конвейера через `PIPESTATUS` — упавший `ssh`
  иначе оставляет валидный, но пустой `.gz`, то есть «успешный» бэкап без данных;
- размер не меньше 1 МиБ;
- `gzip -cd` проходит без ошибок;
- последняя строка дампа — маркер `PostgreSQL database dump complete`
  (главная защита от оборванной передачи).

Флаги:

```bash
npm run db:backup:prod:check                  # только проверить, что база отвечает
bash scripts/backup-prod-db.sh --out DIR      # другой каталог (тоже должен быть в .gitignore)
bash scripts/backup-prod-db.sh --keep 3       # хранить больше одного архива
```

Переменные окружения: `DB_BACKUP_DIR`, `DB_BACKUP_KEEP`, `DB_CONTAINER`,
`DB_BACKUP_MIN_BYTES`.

Замер 2026-08-04: 16 с, ~46,1 МБ (~44 МиБ), распакованный дамп —
198 747 420 байт, 119 таблиц, 126 `COPY`-секций.

В Claude Code то же самое доступно как `/db-backup` и агент `db-backup`
(снять дамп, проверить свежесть копий, восстановить в тестовую базу).

Пароль нигде не нужен: в контейнере `pg_hba.conf` содержит `local all all trust`,
дамп идёт через unix-сокет, а `POSTGRES_USER`/`POSTGRES_DB` берутся из окружения
контейнера.

Дамп содержит персональные данные пользователей — **не класть его в репозиторий
и не пересылать в чат**; каталог хранения держать вне git.

### Ручной вариант без скрипта

Если скрипт недоступен (чужая машина, только ssh):

```bash
bash -c 'source scripts/deploy-target.sh; require_deploy_target >/dev/null; mkdir -p ~/metravel-backups; ssh "$PROD_SSH_TARGET" "docker exec -i metravel_metravel-gis_1 sh -c \"pg_dump --no-owner --no-acl -U \\\$POSTGRES_USER -d \\\$POSTGRES_DB\"" | gzip -9 > ~/metravel-backups/metravel-postgres-$(date -u +%Y%m%dT%H%M%SZ).sql.gz'
```

Обязательно `bash -c`: в zsh `scripts/deploy-target.sh` молча не подхватывает
`.env.deploy` (использует `${BASH_SOURCE[0]}`) и падает с «Не задан адрес
прод-сервера». После такой команды проверки придётся делать руками — см.
[Проверка архива](#проверка-архива).

### Файл на прод-хосте

```bash
docker exec -i metravel_metravel-gis_1 sh -c 'pg_dump --no-owner --no-acl -U "$POSTGRES_USER" -d "$POSTGRES_DB"' | gzip -9 > ~/metravel-postgres-$(date -u +%Y%m%dT%H%M%SZ).sql.gz
```

Файл потом обязательно забрать (`scp`) и удалить с сервера — 46 МБ при 2.6 ГБ
свободного места накапливаются быстро.

### Проверка архива

`npm run db:backup:prod` делает это сам; руками нужно только для архивов,
снятых в обход скрипта:

```bash
gzip -t <файл>                      # целостность
gzip -cd <файл> | head -3           # -- PostgreSQL database dump
gzip -cd <файл> | tail -3           # -- PostgreSQL database dump complete
```

Маркер `complete` в хвосте — единственная надёжная проверка, что дамп не
оборвался: обрезанный архив тоже начинается с корректного заголовка и может
пройти `gzip -t`, если обрыв пришёлся на границу блока.

## Штатный скрипт бэкапа в S3

Канонический скрипт лежит **в бэкенд-репозитории** (`../metravel-backend`, ветка
`master`) и уже развёрнут на проде:

- `deploy/prod/backup/backup_database_to_s3.sh` — сам скрипт;
- `deploy/prod/backup/README.md` — исходная инструкция автора;
- на сервере: `/home/sx3/metravel/deploy/prod/backup/` (версия от 05.08.2026,
  коммит `c2a99c6`).

Из этого workspace бэкенд не редактируется — правки оформляются задачей
`area=back` на общем task board.

Что делает скрипт:

1. `pg_dump --no-owner --no-acl` через `docker exec` по имени контейнера
   (`${DB_CONTAINER}`), без compose — пароль не нужен, внутри контейнера
   `pg_hba.conf` содержит `local all all trust`;
2. поток дампа на хост, сжатие `gzip -9`; весь конвейер fail-closed
   (`set -o pipefail`), пишется во временный файл и переименовывается атомарно;
3. проверка `gzip -t` и минимального размера `${MIN_BACKUP_BYTES}`, затем запись
   в `${BACKUP_DIR}/metravel-postgres-<UTC-timestamp>.sql.gz`;
4. загрузка архива в `${S3_URI}` через `aws s3 cp`;
5. удаление локальных архивов старше `${RETENTION_DAYS}` дней.

Режимы:

- без флагов — полный цикл с выгрузкой в S3 (требует `S3_URI` и `aws`);
- `--check` — только проверка доступности БД и прав, ничего не пишет; годится
  как постоянная прод-проба;
- `--local-only` — снять и проверить локальный архив без S3 и без `aws`.

Переменные окружения (обязательна только `S3_URI`, и только в полном режиме):

```bash
S3_URI=s3://metravel-backups/postgres
DB_CONTAINER=metravel_metravel-gis_1
BACKUP_DIR=/home/sx3/metravel/deploy/prod/backups
RETENTION_DAYS=14
MIN_BACKUP_BYTES=1048576
```

### Первый успешный прогон на проде: 05.08.2026

До 05.08.2026 скрипт на этом хосте не мог отработать вообще: он звал базу через
`compose exec`, а `compose()` предпочитал `docker-compose` v1 из PATH, который
падал на интерполяции `POSTGRES_PASSWORD` (в `/home/sx3/metravel` нет `.env`) ещё
до `pg_dump`. Починено в бэкенде коммитом `c2a99c6` по задаче **#1246**: вызов
переведён на `docker exec` по имени контейнера, конвейер сделан fail-closed.

Проверка на проде 05.08.2026, из cron-подобного окружения
(`env -i PATH=/usr/bin:/bin`):

```
$ bash deploy/prod/backup/backup_database_to_s3.sh --check
[2026-08-05T12:26:51Z] Checking PostgreSQL dump access in container metravel_metravel-gis_1
[2026-08-05T12:26:55Z] PostgreSQL dump check passed          # exit 0

$ BACKUP_DIR=/home/sx3/db-backups bash deploy/prod/backup/backup_database_to_s3.sh --local-only
[2026-08-05T12:27:20Z] Creating PostgreSQL dump from container metravel_metravel-gis_1
[2026-08-05T12:27:34Z] Local-only backup completed: metravel-postgres-20260805T122720Z.sql.gz (52328299 bytes)
```

Артефакт: 52 328 299 байт (~49.9 МиБ), 14 с, `gzip -t` OK, в дампе 119
`CREATE TABLE`, хвост — `-- PostgreSQL database dump complete`. Файл оставлен на
сервере в `/home/sx3/db-backups/` как первая с 17.11.2025 логическая копия базы.

## Что нужно, чтобы включить регулярный бэкап

Все шаги требуют `sudo` на прод-хосте (у деплой-пользователя `sx3`
беспарольного sudo нет) — это работа владельца сервера. Заведено на борде:
**#1247** (`needs_human=true`, зависит от #1246).

1. Установить AWS CLI: `sudo apt-get install -y awscli`.
2. Завести IAM-креды с правом `s3:PutObject` на префикс бэкапов. Аккаунт AWS уже
   используется проектом — там же лежит медиа-бакет `metravelprod` (eu-north-1).
3. ~~Починить вызов compose~~ — сделано 05.08.2026 (#1246), см. раздел выше;
   молчаливый провал в cron больше невозможен (`pipefail` + проверка размера).
4. Создать `/etc/metravel-backup.env` (root, `0600`) с переменными выше.
   `COMPOSE_FILE`/`DB_SERVICE` из старых инструкций скриптом больше не читаются —
   вместо них `DB_CONTAINER` (по умолчанию уже верный).
5. Создать `/etc/cron.d/metravel-db-backup`:

   ```cron
   SHELL=/bin/bash
   PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin

   15 2 * * * sx3 set -a; source /etc/metravel-backup.env; set +a; cd /home/sx3/metravel && ./deploy/prod/backup/backup_database_to_s3.sh >> /var/log/metravel-db-backup.log 2>&1
   ```

6. Создать лог: `/var/log/metravel-db-backup.log`, владелец `sx3:adm`, `0640`.
7. Приёмка: объект реально появился в бакете (`aws s3 ls`), локальный архив
   распаковывается, restore-smoke проходит (ниже).

Про место на диске: один архив ~50 МБ, при `RETENTION_DAYS=14` локально
накопится ~0.7 ГБ при свободных 3.9 ГБ. Локальную ретенцию разумно держать 3–5
дней, а длительное хранение — lifecycle-политикой на стороне S3.

## Восстановление

### Из `.sql.gz` в тестовую базу

В прод напрямую не восстанавливать — только в отдельную базу и только в
согласованное окно.

```bash
# отдельный контейнер того же образа, чтобы был доступен PostGIS
docker run --rm -d --name pg-restore-test -e POSTGRES_PASSWORD=test -e POSTGRES_USER=metravel -e POSTGRES_DB=metravel_restore postgis/postgis:17-3.5
gzip -cd metravel-postgres-<timestamp>.sql.gz | docker exec -i pg-restore-test psql -U metravel -d metravel_restore
docker exec -i pg-restore-test psql -U metravel -d metravel_restore -tAc "select count(*) from information_schema.tables where table_schema='public'"
docker rm -f pg-restore-test
```

Дамп снят с PostGIS-базы и содержит `CREATE EXTENSION`, поэтому восстанавливать
нужно в образ с PostGIS (`postgis/postgis:17-3.5`), а не в чистый `postgres`.

### Из холодной копии PGDATA от 17.11.2025

`/home/sx3/pg_dump_17_11_2025/postgis/data` — это каталог данных, а не дамп.
Поднимается отдельным контейнером `postgis/postgis:17-3.5` с монтированием копии
в `/var/lib/postgresql/data` (сначала убрать `postmaster.pid`), на отдельном
контейнере/порту, **никогда не поверх прод-каталога**. Каталог принадлежит
`root`, нужен sudo.

Копия снималась с работающего каталога (внутри остались `postmaster.pid` и
незачищенный `pg_wal`), так что консистентность не гарантирована: это аварийный
артефакт, а не штатный бэкап.

## Быстрая проверка состояния

```bash
bash -c 'source scripts/deploy-target.sh; require_deploy_target >/dev/null; ssh "$PROD_SSH_TARGET" "ls -la /home/sx3/metravel/deploy/prod/backups/ 2>/dev/null | tail -5; ls -la /etc/cron.d/metravel-db-backup 2>/dev/null || echo NO_CRON; tail -3 /var/log/metravel-db-backup.log 2>/dev/null || echo NO_LOG"'
```

Пока вывод — `NO_CRON` / `NO_LOG` и отсутствующий каталог, регулярных бэкапов
нет: самой свежей копией остаётся ручной дамп от 05.08.2026 в
`/home/sx3/db-backups/`, и он не обновляется. Сам скрипт при этом рабочий —
проверить в любой момент можно `--check` (ничего не пишет).

Связанные документы: `docs/RELEASE.md` (деплой и rollback),
`docs/PRODUCTION_CHECKLIST.md` (релизный чеклист).
