---
name: dev-deploy
description: >-
  Деплой web-фронтенда MeTravel на дев-сервер 192.168.50.36 через `build-dev.sh`
  (сборка dev-env → rsync → swap static/dist → docker compose restart) с
  pre-flight и пост-деплой верификацией. Делегирует агенту `dev-deployer`.
  Триггеры: «задеплой на дев», «выложи на дев-сервер», «обнови дев»,
  «передеплой dev», «почему дев отдаёт 404/502».
---

# dev-deploy

Регламент выкладки фронта на **дев** (`http://192.168.50.36/`). Дев — это
docker-compose стек в `/home/sergey/metravel` (владелец инфры — Sergey/бэкенд).
Наша зона — только статика фронта; инфру (compose/nginx/тома/контейнеры) не трогаем.

## Роли (делегирование)

- **`dev-deployer`** (agent) — выполняет деплой: pre-flight → `build-dev.sh` → verify.
- **`prod-smoke`** (agent) — read-only смоук, если нужно отдельно проверить здоровье.
- **`backend-expert` / `ticket-board`** — если проблема в dev-инфре (docker/nginx/том), а не в нашей статике: диагностируем read-only и заводим тикет, сами инфру не правим.

## Контракт деплоя (как это работает)

`build-dev.sh` кладёт сборку в хостовый `/home/sergey/metravel/static/dist`, а
nginx-контейнер bind-mount'ит **именно этот путь** в свой serve-root
(`docker-compose-local.app.yaml`: `./static/dist:/usr/local/metravel/static/dist:ro`;
конфиг `deploy/local/nginx/nginx.conf`: `root /usr/local/metravel/static/dist; try_files $uri /index.html =404`).
Поэтому скрипт и инфра совместимы. После подмены каталога обязателен
`docker compose restart nginx` — скрипт это делает сам.

SSH: `sergey@192.168.50.36`, вход по ключу. Пароль в чат не просить.

**На сервере НЕ редактируем shell-конфиги/dotfiles** (`~/.bashrc`, `~/.bash_profile`, `~/.profile`, `~/.zshrc`, `~/.ssh/config` и т.п.). Нужна env-переменная для деплой-команды — задавать её инлайн (`VAR=val ssh ... 'VAR=val ...'`) или через env-файлы проекта (`.env*`), а не через `~/.bashrc`. Случайно изменил dotfile сервера — откатить и сообщить.

## Шаги

### 1. Pre-flight (не деплоить на красном)
- `git status` — ветка `main`.
- SSH живой: `ssh -o BatchMode=yes -o ConnectTimeout=6 sergey@192.168.50.36 whoami` → `sergey`.
  Нет связи (`Permission denied`) — стоп, сообщить (ключ настраивается отдельно: `ssh-copy-id sergey@192.168.50.36`).
- Baseline: `curl -s -o /dev/null -w '%{http_code}' http://192.168.50.36/`.

### 2. Деплой
- Полный (с переустановкой зависимостей, медленно): `bash build-dev.sh`.
- Только собрать без выкладки (pre-flight): `DEPLOY=0 bash build-dev.sh`.
- Быстрый редеплой без сноса `node_modules` — см. раздел в агенте `dev-deployer`.
- Не прерывать на rsync/свапе. Ненулевой выход = разобрать причину из вывода (нет `dist/dev/index.html`, упал rsync/ssh, упал `restart`).

### 3. Верификация
- `curl -s -o /dev/null -w '%{http_code}' http://192.168.50.36/` = **200**.
- Открыть `/travelsby` и `/map` — не 404, не белый экран.
- **Транзиентный 404 / `Connection refused` сразу после `restart`** — норма, пока контейнеры
  поднимаются. Подождать и повторить curl 2–3 раза, прежде чем считать это поломкой.
- Сверить с baseline.

## Типовая диагностика (когда дев «не работает»)

- **404 на `/`, но статика на месте** — чаще всего стек в процессе пересоздания (идёт деплой):
  `ssh sergey@192.168.50.36 'docker ps --format "{{.Names}}\t{{.Status}}"'`. Дождаться, что
  `nginx`/`app` в `Up`, повторить curl.
- **502** — обычно `app`-контейнер (`:8000`) не поднялся/нездоров; смотреть `docker compose logs app`.
- **Старый фронт после деплоя** — не перезапущен nginx: `docker compose restart nginx`.
- Инфру (compose/nginx-конфиг/тома) сами не правим — read-only диагностика + тикет на бэк.

## Границы

- Только дев `192.168.50.36`. Прод `metravel.by` — скилл/агент `frontend-deployer`. Нативные сборки — EAS (`android-*`).
- Не редактировать `docker-compose*.yaml`, `deploy/local/nginx/*`, тома и контейнеры на деве.
