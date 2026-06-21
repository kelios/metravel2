# TASK-20260621-001: [BE] Прод app-контейнер уходит в unhealthy: насыщение CLOSE_WAIT → 502

Status: Backlog
Owner: Backend
Support: Tester, Reviewer
Created: 2026-06-21
Updated: 2026-06-21

> PENDING BOARD SYNC — создано локально из-за board 401 (протух DRF-токен в `.secrets/metravel-task-board.env`; обновить может только владелец). Импортировать на борд (area=back, assignee Sergey) после обновления токена, затем этот файл удалить.

## Goal

Устранить накопление CLOSE_WAIT-соединений в прод app-контейнере `metravel_app_1`, из-за которого nginx периодически не получает ответ от апстрима и отдаёт 502 на всём `/api/*` и `/travel-image/*`. Рестарт контейнера — временный митигейшн, нужен постоянный фикс на стороне приложения.

## Context

**Симптом (зафиксирован 2026-06-21 при деплое фронта):** периодически весь прод metravel.by деградирует — массовые `502 Bad Gateway` на ключевых эндпоинтах:

- `GET /api/achievements/*`
- `GET /api/travels/search_travels_for_map/`
- `GET /api/user/{id}/profile/`
- `GET /api/filterformap/`
- `GET /travel-image/.../*.webp`

Страницы зависают до таймаута. Ошибки React Query #418/#419 в этот момент — следствие отсутствующих данных при гидрации, не первопричина.

**Диагностика (2026-06-21):** контейнер `metravel_app_1` был unhealthy; в `ss -tan state close-wait` накоплено большое число CLOSE_WAIT. Временно вылечено рестартом контейнера. Проблема воспроизводится повторно — соединения не закрываются и копятся.

**Гипотеза первопричины:** незакрытые или «зависшие» TCP-соединения к внешним сервисам (HTTP-клиенты achievements/gamification API, image-сервис, geocoding/overpass, OWM погода и т.п.) — отсутствие явных таймаутов, неправильный teardown keep-alive, возможно неограниченные пулы. Когда FD/backlog забиваются — Django/gunicorn перестаёт принимать новые запросы, nginx получает connect-refused или timeout → 502.

**Ожидаемые области анализа:** HTTP-сессии/клиенты в Django (requests.Session, aiohttp, httpx); конфиг gunicorn (worker-class, worker-connections, keepalive, timeout); nginx upstream keepalive; healthcheck и политика авторестарта (только митигейшн).

Source task:

- Source id:
- Source path:

## Acceptance Criteria

- [ ] На проде `ss -tan state close-wait | wc -l` у app-контейнера не растёт со временем под нагрузкой (стабильное значение < baseline или нулевой тренд за 30 мин наблюдения).
- [ ] Нет 502 от апстрима на `/api/filterformap/`, `/api/achievements/*`, `/api/user/{id}/profile/`, `/travel-image/.../*.webp` в наблюдаемый период (10 последовательных запросов — все 200).
- [ ] Рестарт app-контейнера больше не требуется как регулярная мера для восстановления 200-ответов.
- [ ] Если healthcheck/авторестарт добавлен — он явно задокументирован как митигейшн, а не как фикс первопричины.
- [ ] Изменения покрыты комментарием в коде (почему таймаут/пул именно такой).

## Gherkin Tests

```gherkin
Feature: Стабильность прод app-контейнера под нагрузкой

  Scenario: CLOSE_WAIT не накапливается при последовательных запросах к внешним сервисам
    Given прод app-контейнер metravel_app_1 запущен и healthy
    When выполняется серия запросов к /api/filterformap/, /api/achievements/ и /travel-image/ в течение 30 минут
    Then счётчик ss -tan state close-wait у контейнера не растёт (нет положительного тренда)
    And nginx не возвращает ни одного 502 Bad Gateway

  Scenario: Ответы /api/* и /travel-image/* без перезапуска контейнера
    Given прод работает сутки без рестарта app-контейнера
    When curl запрашивает https://metravel.by/api/filterformap/ 10 раз подряд
    Then все 10 ответов имеют HTTP 200
    And время ответа не превышает 5 секунд

  Scenario: Изолированный сбой внешнего HTTP-клиента не роняет весь апстрим
    Given внешний сервис (например, achievements API или overpass) не отвечает за таймаут
    When Django обращается к нему через HTTP-клиент с настроенным таймаутом
    Then запрос завершается с ошибкой таймаута, соединение закрывается корректно
    And CLOSE_WAIT не появляется в ss для этого соединения
    And остальные /api/* эндпоинты продолжают возвращать 200
```

## Task Contract

Scope: Только бэкенд (отдельный репо `../metravel-backend`). FE-репо не затрагивается. Изменения — конфигурация HTTP-клиентов Django, параметры gunicorn, возможно nginx upstream keepalive. Деплой — Sergey/Codex.

User-visible result: Прод metravel.by перестаёт периодически отдавать 502 и «зависать». Страницы (карта, профиль, достижения, изображения) загружаются стабильно без необходимости рестарта сервера.

Data/API contract:
  Затронутые эндпоинты (только диагностика, не меняются контракты):
  - `GET /api/filterformap/` → 200 JSON (список маркеров)
  - `GET /api/achievements/*` → 200 JSON
  - `GET /api/user/{id}/profile/` → 200 JSON
  - `GET /api/travels/search_travels_for_map/` → 200 JSON
  - `GET /travel-image/.../*.webp` → 200 binary (через nginx proxy_pass или отдельный сервис)

  Контракты ответов не меняются. Изменения касаются исключительно внутренней конфигурации:
  - HTTP-клиенты (requests/httpx/aiohttp): явные `timeout` и корректный teardown сессий
  - gunicorn: `--timeout`, `--keep-alive`, `--worker-connections` под review
  - nginx: `upstream keepalive` — при необходимости
  - docker-compose healthcheck: `interval`, `timeout`, `retries` — митигейшн

Dependencies:
  - Доступ к прод-серверу (SSH) — у Sergey
  - Репо metravel-backend — у Sergey/Codex
  - Нет зависимостей на FE-задачи

Fallback/mock policy: FE не имеет fallback на эту проблему. Текущий митигейшн — ручной рестарт контейнера через docker-compose restart metravel_app_1. Это НЕ фикс; продолжать применять только до закрытия задачи.

Validation:
  На сервере после деплоя фикса:
  1. `docker exec metravel_app_1 ss -tan state close-wait | wc -l` — снять baseline, повторить через 15 и 30 мин под нагрузкой; тренд должен быть нулевым или убывающим.
  2. `for i in $(seq 1 10); do curl -s -o /dev/null -w '%{http_code}\n' https://metravel.by/api/filterformap/; done` — все строки 200.
  3. `docker inspect metravel_app_1 --format '{{.State.Health.Status}}'` — должно быть healthy.
  4. Наблюдение за логами nginx error.log на предмет upstream-502 в течение 1 часа.

Done gate: Задача закрывается (done) только при одновременном выполнении всех AC + подтверждении от `backend-status-sync` (верификация в комментарии тикета борда).

## Assignment

Primary owner: Backend (Sergey / Codex — репо metravel-backend)
Support agents: `backend-expert` (read-only диагностика), `backend-status-sync` (верификация закрытия на борде)

## Likely Files Or Areas

- `metravel-backend/` — HTTP-клиенты к внешним сервисам (achievements, geocoding, overpass, OWM, image-service)
- `metravel-backend/` — конфиг gunicorn (Procfile, entrypoint, docker CMD)
- `metravel-backend/` — Django settings: CONN_MAX_AGE, любые кастомные HTTP-сессии/адаптеры
- `docker-compose.yml` (прод) — healthcheck секция `metravel_app_1`, restart policy
- nginx конфиг — секция `upstream` (keepalive directive)

## Plan

1. Аудит всех исходящих HTTP-клиентов в metravel-backend: найти места без явного `timeout`, незакрытые `requests.Session`, отсутствие `with`-блоков или явного `.close()`.
2. Добавить явные таймауты (connect + read) на все исходящие HTTP-вызовы; использовать сессии через контекстный менеджер или закрывать в finally.
3. Проверить конфиг gunicorn: `--timeout` (рекомендуется 30s), `--keep-alive` (1-2s если не нужно дольше), `--worker-connections`.
4. Проверить nginx upstream: если используется keepalive к gunicorn — убедиться, что `keepalive` directive выставлен разумно (или убрать, если не нужен).
5. Добавить/починить docker healthcheck для `metravel_app_1` с авторестартом как митигейшн (policy: `on-failure` или `unless-stopped` + healthcheck).
6. Деплой фикса на прод, снять метрики CLOSE_WAIT до и после.
7. Передать верификацию агенту `backend-status-sync` для закрытия тикета на борде.

## Validation

```bash
# 1. Счётчик CLOSE_WAIT у app-контейнера (baseline + через 30 мин под нагрузкой)
docker exec metravel_app_1 ss -tan state close-wait | wc -l

# 2. Probe 10 запросов к ключевому эндпоинту — все должны быть 200
for i in $(seq 1 10); do curl -s -o /dev/null -w '%{http_code}\n' https://metravel.by/api/filterformap/; done

# 3. Дополнительные эндпоинты
curl -s -o /dev/null -w '%{http_code}\n' https://metravel.by/api/achievements/
curl -s -o /dev/null -w '%{http_code}\n' https://metravel.by/api/user/1/profile/

# 4. Статус healthcheck контейнера
docker inspect metravel_app_1 --format '{{.State.Health.Status}}'

# 5. Мониторинг nginx error.log (1 час)
tail -f /var/log/nginx/error.log | grep 502
```

## Release Checklist

- [ ] Changed files are listed in `## Results`.
- [ ] New files created by this task are identified.
- [ ] Generated/cache/secret/local files are excluded.
- [ ] Task-scope files are staged when the user asks to prepare git.
- [ ] Skipped files and release blockers are recorded.

## Progress Log

- 2026-06-21: Created. Board 401 (DRF-токен протух) — локальный черновик; импортировать на борд (area=back, assignee Sergey) после обновления токена.

## Results

Changed files:

Validation evidence:

Reviewer findings:

Release notes:

Blockers: Board недоступен (HTTP 401 — протух DRF-токен в `.secrets/metravel-task-board.env`). Импорт на борд заблокирован до обновления токена владельцем.
