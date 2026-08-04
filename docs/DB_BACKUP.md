# Бэкап production-базы metravel.by

Актуализировано: 2026-08-04 (все цифры ниже сняты с прода в этот день).

## TL;DR

- **Автоматических бэкапов БД на проде нет.** Cron-задачи, S3-выгрузки и логов
  бэкапа не существует.
- **Единственная копия базы — от 17.11.2025**:
  `/home/sx3/pg_dump_17_11_2025/postgis/data`, 372.9 МиБ, владелец `root`.
  Несмотря на имя, это не логический дамп, а холодная копия каталога данных
  PostgreSQL 17 (внутри `PG_VERSION`, `base/`, `pg_wal/`, `postmaster.pid`).
- **Свежий дамп снимается одной командой** `npm run db:backup:prod` — ~16 секунд,
  ~44 МиБ `.sql.gz` в `~/metravel-backups`, с проверкой целостности; см.
  [Как снять бэкап прямо сейчас](#как-снять-бэкап-прямо-сейчас).

## Что где лежит

| Объект | Путь / расположение | Состояние на 2026-08-04 |
| --- | --- | --- |
| Живая БД | контейнер `metravel_metravel-gis_1`, образ `postgis/postgis:17-3.5`, база `metravel`, пользователь `metravel` | 311 MB (`pg_database_size`) |
| Каталог данных живой БД | bind-mount `/home/sx3/metravel/deploy/prod/postgis/data` (в compose — `./deploy/prod/postgis/data`) | 431.9 МиБ |
| Единственная копия базы | `/home/sx3/pg_dump_17_11_2025/postgis/data` | файлы от **17.11.2025**, 372.9 МиБ, `root:root` |
| Локальные дампы скрипта (`BACKUP_DIR`) | `/home/sx3/metravel/deploy/prod/backups/` | каталога не существует |
| Дампы в S3 | не настроено: `aws` CLI не установлен, `~/.aws` нет | — |
| Диск под всё это | `/dev/sda1` → `/` | 15 ГБ, занято 82 %, свободно ~2.6 ГБ |

Как проверялось: поиск по всему корню хоста, включая root-owned каталоги
(`docker run --rm -v /:/host:ro alpine find /host -xdev … -size +1M`), не нашёл
ни одного `*.sql`, `*.sql.gz`, `*.dump` или `*backup*` крупнее 1 МиБ. То есть
других копий базы на сервере нет.

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
`~/metravel-backups/metravel-postgres-<UTC>.sql.gz`, права `600`, хранятся
последние 7 архивов.

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
bash scripts/backup-prod-db.sh --out DIR      # другой каталог
bash scripts/backup-prod-db.sh --keep 14      # сколько последних архивов хранить
```

Переменные окружения: `DB_BACKUP_DIR`, `DB_BACKUP_KEEP`, `DB_CONTAINER`,
`DB_BACKUP_MIN_BYTES`.

Замер 2026-08-04: 16 с, 46 105 503 байта (~44 МиБ), распакованный дамп —
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
- на сервере: `/home/sx3/metravel/deploy/prod/backup/` (версия от 09.06.2026).

Из этого workspace бэкенд не редактируется — правки оформляются задачей
`area=back` на общем task board.

Что делает скрипт:

1. `pg_dump --no-owner --no-acl` внутри сервиса `metravel-gis`;
2. поток дампа на хост, сжатие `gzip -9`;
3. запись в `${BACKUP_DIR}/metravel-postgres-<UTC-timestamp>.sql.gz`;
4. загрузка архива в `${S3_URI}` через `aws s3 cp`;
5. удаление локальных архивов старше `${RETENTION_DAYS}` дней.

Переменные окружения (обязательна только `S3_URI`):

```bash
S3_URI=s3://metravel-backups/postgres
COMPOSE_FILE=/home/sx3/metravel/docker-compose-prod.infrastructure.yaml
DB_SERVICE=metravel-gis
BACKUP_DIR=/home/sx3/metravel/deploy/prod/backups
RETENTION_DAYS=14
```

### Известная проблема: на этом хосте скрипт в текущем виде упадёт

Скрипт вызывает базу через `compose exec`, а `compose()` предпочитает
`docker-compose` v1, если он есть в PATH. На проде он есть
(`/usr/bin/docker-compose`, 1.29.2, при наличии docker compose v2.34.0), и вызов
падает ещё до `pg_dump`:

```
Missing mandatory value for "environment" option interpolating
['POSTGRES_PASSWORD=${POSTGRES_PASSWORD:?POSTGRES_PASSWORD must be set}', …]
in service "metravel-gis": POSTGRES_PASSWORD must be set
```

Причина: в `/home/sx3/metravel` нет `.env` (только `.env.example`), а контейнеры
подняты с окружением из другого источника, поэтому compose не может
интерполировать `POSTGRES_PASSWORD`. Заведено на борде: **#1246**
(`area=back`, kind=bug). Лечится одним из двух способов:

- передавать compose явный `--env-file` с прод-переменными, либо
- заменить `compose exec -T "${DB_SERVICE}"` на `docker exec -i` по имени
  контейнера (`metravel_metravel-gis_1`) — ровно тот путь, который проверен
  выше и работает без пароля.

## Что нужно, чтобы включить регулярный бэкап

Все шаги требуют `sudo` на прод-хосте (у деплой-пользователя `sx3`
беспарольного sudo нет) — это работа владельца сервера. Заведено на борде:
**#1247** (`needs_human=true`, зависит от #1246).

1. Установить AWS CLI: `sudo apt-get install -y awscli`.
2. Завести IAM-креды с правом `s3:PutObject` на префикс бэкапов. Аккаунт AWS уже
   используется проектом — там же лежит медиа-бакет `metravelprod` (eu-north-1).
3. Починить вызов compose (см. «Известная проблема»), иначе cron будет молча
   падать каждую ночь.
4. Создать `/etc/metravel-backup.env` (root, `0600`) с переменными выше.
5. Создать `/etc/cron.d/metravel-db-backup`:

   ```cron
   SHELL=/bin/bash
   PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin

   15 2 * * * sx3 set -a; source /etc/metravel-backup.env; set +a; cd /home/sx3/metravel && ./deploy/prod/backup/backup_database_to_s3.sh >> /var/log/metravel-db-backup.log 2>&1
   ```

6. Создать лог: `/var/log/metravel-db-backup.log`, владелец `sx3:adm`, `0640`.
7. Приёмка: объект реально появился в бакете (`aws s3 ls`), локальный архив
   распаковывается, restore-smoke проходит (ниже).

Про место на диске: один архив ~46 МБ, при `RETENTION_DAYS=14` локально
накопится ~0.65 ГБ при свободных 2.6 ГБ. Локальную ретенцию разумно держать 3–5
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
нет и последней актуальной копией остаётся холодный каталог от 17.11.2025.

Связанные документы: `docs/RELEASE.md` (деплой и rollback),
`docs/PRODUCTION_CHECKLIST.md` (релизный чеклист).
