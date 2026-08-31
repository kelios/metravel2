# Бэкап production-базы metravel.by

Актуализировано: 2026-08-31 — включён ежедневный бэкап в S3 (борд #1247).

## TL;DR

- **Ежедневный бэкап работает.** Cron на прод-хосте в 02:15 по Минску снимает
  `pg_dump`, проверяет архив и выгружает его в S3. Включено 31.08.2026, первый
  боевой прогон — `metravel-postgres-20260831T103912Z.sql.gz`, 56 335 429 байт,
  `gzip -t` OK, в логе `Backup completed`.
- **Бэкапы лежат в отдельном приватном бакете `s3://metravel-backups/postgres/`**
  (eu-north-1, Block Public Access на всех четырёх флагах, versioning включён).
- ⚠️ **В медиа-бакет `metravelprod` бэкапы лить нельзя.** У него политика
  `Principal: "*"` + `s3:GetObject` на `metravelprod/*`: дамп с почтами и хешами
  паролей качался бы по прямой ссылке кем угодно.
- **Проверить состояние:** `npm run db:backup:prod:verify` — расписание, лог,
  локальный архив, объект в S3, одним прогоном.
- **Снять внеочередной дамп себе на мак:** `npm run db:backup:prod` (~16 с,
  ~54 МиБ в `backup/`).
- **Забрать готовый архив, почистить старые, выключить расписание** — разделы
  [Как забрать бэкап](#как-забрать-бэкап) и
  [Как почистить и удалить](#как-почистить-и-удалить).
- До 05.08.2026 автоматических бэкапов не было вообще, а единственная копия была
  холодной от 17.11.2025 — история в задачах #1246 (скрипт починен) и #1247
  (расписание включено).

## Что где лежит

| Объект | Путь / расположение | Состояние на 2026-08-31 |
| --- | --- | --- |
| Живая БД | контейнер сервиса `metravel-gis` (сейчас `metravel_metravel-gis_1`; имя резолвится, а не вписывается — см. ниже), образ `postgis/postgis:17-3.5`, база `metravel` | ~311 MB |
| Расписание | user crontab пользователя `sx3`, строка с маркером `# metravel-db-backup` | `15 2 * * *`, таймзона хоста Europe/Minsk |
| Обёртка запуска | `/home/sx3/.local/bin/metravel-db-backup` (0700) | генерируется `scripts/enable-prod-db-backup.sh`, руками не править |
| Конфиг | `/home/sx3/.metravel-backup.env` (0600) | `S3_URI`, `BACKUP_DIR`, `RETENTION_DAYS=5`, `AWS_CLI`, `LOG_FILE`; секретов нет |
| Лог | `/home/sx3/logs/metravel-db-backup.log` (0640) | одна строка `Backup completed` на успешную ночь |
| Локальные архивы | `/home/sx3/metravel/deploy/prod/backups/` | ~54 МиБ штука, ретенция 5 дней, чистится самим скриптом |
| Архивы в S3 | `s3://metravel-backups/postgres/` | приватный бакет, versioning on, lifecycle НЕ настроен |
| Ключ S3 | `/home/sx3/.aws/credentials` (0600, владелец `sx3`) | пока общий ключ приложения — сузить, см. [Что осталось владельцу](#что-осталось-владельцу) |
| AWS CLI | `/home/sx3/.local/aws-cli`, бинарь `/home/sx3/.local/bin/aws` | v2.36.34, userland-установка без root, 271 МБ |
| Каталог данных живой БД | bind-mount `/home/sx3/metravel/deploy/prod/postgis/data` | 431.9 МиБ |
| Ручной дамп 05.08.2026 | `/home/sx3/db-backups/metravel-postgres-20260805T122720Z.sql.gz` | 52 328 299 Б, не обновляется, можно удалить |
| Старая холодная копия | `/home/sx3/pg_dump_17_11_2025/postgis/data` | файлы от **17.11.2025**, 372.9 МиБ, `root:root` |
| Диск под всё это | `/dev/sda1` → `/` | 15 ГБ, занято 76 %, свободно ~3.5 ГБ |

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
bash -c 'source scripts/deploy-target.sh; DB_CTR="$(metravel_resolve_container_over_ssh metravel-gis)" || exit 1; mkdir -p ~/metravel-backups; ssh "$PROD_SSH_TARGET" "docker exec -i $DB_CTR sh -c \"pg_dump --no-owner --no-acl -U \\\$POSTGRES_USER -d \\\$POSTGRES_DB\"" | gzip -9 > ~/metravel-backups/metravel-postgres-$(date -u +%Y%m%dT%H%M%SZ).sql.gz'
```

Обязательно `bash -c`: в zsh `scripts/deploy-target.sh` молча не подхватывает
`.env.deploy` (использует `${BASH_SOURCE[0]}`) и падает с «Не задан адрес
прод-сервера». После такой команды проверки придётся делать руками — см.
[Проверка архива](#проверка-архива).

### Файл на прод-хосте

Имя контейнера сюда приносим с рабочей машины: `scripts/deploy-target.sh` живёт
в репозитории фронтенда, а каталог деплоя на прод-хосте — это checkout бэкенда,
и `source` его там не найдёт. Регулярка при этом остаётся в одном экземпляре
(#1636).

Шаг 1, на рабочей машине — узнать имя:

```bash
bash -c 'source scripts/deploy-target.sh; metravel_resolve_container_over_ssh metravel-gis'
```

Шаг 2, на прод-хосте — подставить полученное имя вместо `<db-контейнер>`:

```bash
docker exec -i '<db-контейнер>' sh -c 'pg_dump --no-owner --no-acl -U "$POSTGRES_USER" -d "$POSTGRES_DB"' | gzip -9 > ~/metravel-postgres-$(date -u +%Y%m%dT%H%M%SZ).sql.gz
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
DB_CONTAINER=            # пусто = резолвить на проде; задавать только для разового прогона
BACKUP_DIR=/home/sx3/metravel/deploy/prod/backups
RETENTION_DAYS=14          # дефолт скрипта; на проде выставлено 5
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

## Ежедневный бэкап в S3: как включён

Установка и приёмка — одной командой из этого репозитория:

```bash
bash scripts/enable-prod-db-backup.sh            # установить/обновить, идемпотентно
bash scripts/enable-prod-db-backup.sh --run-now  # прогнать полный цикл прямо сейчас
npm run db:backup:prod:verify                    # проверить критерии приёмки #1247
```

Скрипт бэкапа при этом **не дублируется**: обёртка на хосте запускает
канонический `deploy/prod/backup/backup_database_to_s3.sh` из бэкенд-чекаута.
Имя контейнера БД не вписано константой — оно резолвится снипетом из
`scripts/deploy-target.sh`, поэтому пересоздание сервиса через compose v2
(смена `metravel_metravel-gis_1` → `metravel-metravel-gis-1`) расписание не
ломает (борд #733, #1636).

### Почему не `/etc/cron.d`, как в карточке #1247

Две причины, обе выяснились при включении:

1. У `sx3` sudo только по паролю, поэтому root-шаги агент выполнить не может.
2. Исходная схема из карточки нерабочая сама по себе: cron-задача запускается
   **от `sx3`**, а файл `/etc/metravel-backup.env` с правами `0600 root` он не
   прочитает — `source` в cron-строке упал бы в первую же ночь.

Снаружи разницы нет: то же расписание, тот же скрипт, тот же результат в S3.
Если хочется root-owned расписание — см. ниже.

### Как поднять расписание в root (необязательно)

```bash
sudo install -m 0644 /dev/stdin /etc/cron.d/metravel-db-backup <<'CRON'
SHELL=/bin/bash
PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin

15 2 * * * sx3 /home/sx3/.local/bin/metravel-db-backup
CRON
crontab -l | grep -v metravel-db-backup | crontab -   # иначе бэкап пойдёт дважды
```

Обёртка, конфиг, лог и ключ при этом остаются на месте — они и так читаются от
`sx3`.

## Как забрать бэкап

Все команды — с мака, из корня репозитория. `backup/` в `.gitignore`, дампы
туда класть безопасно.

```bash
# что вообще лежит в S3
bash -c 'source scripts/deploy-target.sh; require_deploy_target >/dev/null; \
  ssh "$PROD_SSH_TARGET" "~/.local/bin/aws s3 ls s3://metravel-backups/postgres/"'

# скачать конкретный архив из S3 сразу на мак (потоком, на диск прода не пишем)
mkdir -p backup && bash -c 'source scripts/deploy-target.sh; require_deploy_target >/dev/null; \
  ssh "$PROD_SSH_TARGET" "~/.local/bin/aws s3 cp s3://metravel-backups/postgres/metravel-postgres-20260831T103912Z.sql.gz -"' \
  > backup/metravel-postgres-20260831T103912Z.sql.gz

# забрать последний локальный архив с сервера (быстрее, без обращения к S3)
bash -c 'source scripts/deploy-target.sh; require_deploy_target >/dev/null; \
  ssh "$PROD_SSH_TARGET" "ls -1t ~/metravel/deploy/prod/backups/*.sql.gz | head -1"'
bash -c 'source scripts/deploy-target.sh; require_deploy_target >/dev/null; \
  scp "$PROD_SSH_TARGET:/home/sx3/metravel/deploy/prod/backups/<имя>.sql.gz" backup/'

# снять свежий дамп мимо расписания
npm run db:backup:prod
```

Проверить скачанное перед тем, как на него полагаться:

```bash
gzip -t backup/<имя>.sql.gz && echo "архив цел"
gzip -cd backup/<имя>.sql.gz | head -2      # ждём заголовок «-- PostgreSQL database dump»
gzip -cd backup/<имя>.sql.gz | grep -c '^CREATE TABLE'
```

Восстановление в тестовую базу — раздел [Восстановление](#восстановление).

## Как почистить и удалить

**Локальные архивы на сервере** чистятся сами: скрипт удаляет всё старше
`RETENTION_DAYS` (сейчас 5). Вручную:

```bash
bash -c 'source scripts/deploy-target.sh; require_deploy_target >/dev/null; \
  ssh "$PROD_SSH_TARGET" "ls -la ~/metravel/deploy/prod/backups/"'
bash -c 'source scripts/deploy-target.sh; require_deploy_target >/dev/null; \
  ssh "$PROD_SSH_TARGET" "rm -f ~/metravel/deploy/prod/backups/metravel-postgres-<timestamp>.sql.gz"'
```

Ретенцию меняют не правкой файла на хосте, а переустановкой — иначе следующий
прогон `enable-prod-db-backup.sh` вернёт прежнее значение:

```bash
RETENTION_DAYS=10 bash scripts/enable-prod-db-backup.sh
```

**Архивы в S3.** У бакета включён versioning, поэтому обычное удаление только
ставит delete marker: объект исчезает из листинга, но место занимает и деньги
стоит. Полное удаление — вместе с версиями:

```bash
# мягко: спрятать объект (остаётся как версия, восстановимо)
ssh "$PROD_SSH_TARGET" "~/.local/bin/aws s3 rm s3://metravel-backups/postgres/<имя>.sql.gz"

# насовсем: снести все версии одного объекта
ssh "$PROD_SSH_TARGET" '~/.local/bin/aws s3api list-object-versions \
  --bucket metravel-backups --prefix postgres/<имя>.sql.gz \
  --query "[Versions,DeleteMarkers][].VersionId" --output text \
  | tr "\t" "\n" | while read -r v; do [ -n "$v" ] && ~/.local/bin/aws s3api delete-object \
      --bucket metravel-backups --key postgres/<имя>.sql.gz --version-id "$v"; done'
```

Если ключ окажется без прав на удаление — чистить в консоли AWS, это нормальный
путь: тому, кто пишет бэкапы, право их удалять и не нужно.

**Выключить расписание** (файлы и архивы остаются):

```bash
ssh "$PROD_SSH_TARGET" "crontab -l | grep -v metravel-db-backup | crontab -"
```

**Снести установку целиком** (архивы в S3 при этом остаются):

```bash
ssh "$PROD_SSH_TARGET" 'crontab -l | grep -v metravel-db-backup | crontab -; \
  rm -f ~/.local/bin/metravel-db-backup ~/.metravel-backup.env ~/.metravel-backup.lock \
        ~/logs/metravel-db-backup.log'
# и, если больше не нужен CLI с ключом:
ssh "$PROD_SSH_TARGET" 'rm -rf ~/.local/aws-cli ~/.local/bin/aws ~/.local/bin/aws_completer ~/.aws'
```

Удалять сам бакет `metravel-backups` через CLI неудобно (нужно сначала вычистить
все версии) — проще в консоли AWS, «Empty» и затем «Delete».

## Что осталось владельцу

Ничего из этого не блокирует работу бэкапа — это гигиена.

1. **Сузить ключ S3.** Сейчас cron ходит в S3 общим ключом приложения (тем же,
   что обслуживает медиа-бакет: он умеет в том числе создавать бакеты). Правильно
   — отдельный IAM-пользователь только на префикс бэкапов:

   ```json
   {
     "Version": "2012-10-17",
     "Statement": [
       {
         "Sid": "PutBackups",
         "Effect": "Allow",
         "Action": ["s3:PutObject"],
         "Resource": "arn:aws:s3:::metravel-backups/postgres/*"
       },
       {
         "Sid": "ListBackupPrefix",
         "Effect": "Allow",
         "Action": ["s3:ListBucket"],
         "Resource": "arn:aws:s3:::metravel-backups",
         "Condition": {"StringLike": {"s3:prefix": ["postgres/*"]}}
       }
     ]
   }
   ```

   После создания ключа — заменить `~/.aws/credentials` на проде (0600, владелец
   `sx3`) и прогнать `npm run db:backup:prod:verify`.

2. **Lifecycle в S3.** Сейчас бакет растёт примерно на 1.6 ГБ в месяц и ничего не
   удаляется. Разумно — правило «expire через 90 дней» плюс
   `NoncurrentVersionExpiration`.

3. **Ротация лога.** `/home/sx3/logs/metravel-db-backup.log` растёт медленно
   (~200 байт в сутки), но `logrotate` под него не заведён.

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
npm run db:backup:prod:verify
```

Проверяет всё, чем закрывается #1247: cron-строку, лог и число суток с
`Backup completed`, свежий локальный архив (`gzip -t` + заголовок дампа) и
объект в S3 с совпадением размера. Возвращает ненулевой код, пока критерии не
выполнены, поэтому годится и как разовая приёмка, и как прод-проба.

Проверить только доступность БД, ничего не записывая:

```bash
npm run db:backup:prod:check
```

Связанные документы: `docs/RELEASE.md` (деплой и rollback),
`docs/PRODUCTION_CHECKLIST.md` (релизный чеклист).
