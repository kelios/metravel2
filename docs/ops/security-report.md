# Ежедневный security-отчёт прод-хоста (#2721)

Каждое утро в 09:10 по времени хоста (Europe/Minsk) cron пользователя `sx3`
собирает сводку безопасности за последние 24 часа и шлёт письмом на адрес из
конфига (по умолчанию тот же, что у SEO-отчёта). Тема письма:
`Security report metravel.by DD.MM.YYYY: OK` либо `N ⚠` — число отклонений.

## Что в письме

| раздел | источник на хосте | что считается |
| --- | --- | --- |
| SSH | `/var/log/auth.log*`, `/var/log/fail2ban.log*` | неудачные попытки (одно соединение sshd — одна попытка) и адреса, `Found`, баны по jail `sshd` / `sshd-slow` / `recidive`, восстановленные баны, топ атакующих, успешные входы (⚠ если адрес не из своих) |
| Web | `docker logs metravel-nginx-1` за окно (JSON access + stderr) | внешние запросы без своих адресов, статусы, сканеры (`.env`, `.git`, `wp-*`, `*.php`), `POST /admin/login/` с разбивкой «отказ 403/429» и «дошли до проверки пароля» (⚠ от 10 дошедших), срабатывания `limit_req` по чужим адресам и зонам (⚠ от 20 вне зоны `login`), 5xx по путям, топ сетей `/24` / `/48` |
| Роботы | `user_agent` против `https://metravel.by/robots.txt` | запросов по каждому роботу, разделы сайта, пометка «закрыт в robots.txt, отдано N», где N — ответы не 403, не редирект и не сам `/robots.txt`; ⚠ если закрытому роботу отдано ≥50 — nginx его не режет |
| Почта приложения | `~/.local/state/metravel/moderation-reminders.log`, `~/metravel-monitor/relay-queue.cron.log` | ошибки SMTP рассылки модерации (⚠ при любой), отложенные письма в очереди Postfix |
| Хост | `df`, `free`, `/proc/loadavg`, `/var/run/reboot-required`, `/var/tmp/system_monitor.state`, `docker ps -a` | диск (⚠ от 85 %), память, нагрузка, состояние `monitor.sh`, нездоровые контейнеры |
| Итог | файл состояния прошлого прогона | дельты «ко вчера» по ключевым числам и список ⚠ |

Root-логи (`syslog:adm 640`) читаются одноразовым контейнером `alpine` с
`-v /var/log:/hostlog:ro --network none` — только чтение, без sudo. Персональные
данные посетителей в письмо не попадают: только IP атакующих и UA роботов, а
общий топ трафика — сетями `/24` (IPv4) и `/48` (IPv6), без адреса посетителя.
Access-лог nginx разбирается потоком, не читается в память целиком.

## Где что лежит

| что | путь |
| --- | --- |
| источник скрипта (в git) | `scripts/security-report.py` |
| установщик (в git) | `scripts/enable-prod-security-report.sh` |
| копия скрипта на хосте | `~/.local/bin/metravel-security-report.py` |
| обёртка cron | `~/.local/bin/metravel-security-report` (`--dry-run` печатает без письма) |
| конфиг | `~/.metravel-security-report.env` (`SECURITY_REPORT_EMAIL`, `SECURITY_REPORT_HOST`, `SECURITY_REPORT_IGNORE_IPS`) |
| лог | `~/logs/metravel-security-report.log` (ротация 4×1 МБ) |
| состояние для дельт | `~/.local/state/metravel/security-report-state.json` |
| cron | строка user crontab с маркером `# metravel-security-report` |

## Команды

```bash
bash scripts/enable-prod-security-report.sh            # установить/обновить (идемпотентно)
bash scripts/enable-prod-security-report.sh --preview  # собрать и показать, не отправляя
bash scripts/enable-prod-security-report.sh --run-now  # собрать и отправить сейчас (состояние дельт не трогает)
bash scripts/enable-prod-security-report.sh --verify   # cron, файлы, последний прогон
```

Свой публичный IPv4 установщик берёт через `ifconfig.me` в момент установки и
добавляет к IPv6 монитора ротаций; при смене адреса — переустановить или задать
`IGNORE_IPS="1.2.3.4 2a0a:7d80:3:2::186"`. После правки `scripts/security-report.py`
обязательна переустановка: на хосте лежит копия, не симлинк.

## Проверка без прода

`__tests__/scripts/security-report.test.ts` кормит скрипт фикстурами через флаги
`--nginx-log/--nginx-err/--fail2ban-log/--auth-log/--moderation-log/--relay-log/--robots`
с `--now` и `--log-utc-offset` (метки fail2ban наивные, в зоне хоста; лог модерации
пишет Django с `TIME_ZONE = 'UTC'`, его метки всегда читаются в UTC),
`--no-host --dry-run`. Тест держит окно, исключение своих адресов, пороги ⚠ и дельты.

## Принуждение на nginx (#2823)

С 27.10.2026 два предупреждения отчёта закрыты на nginx бэка
(`../metravel-backend/deploy/prod/nginx/nginx.conf`):

- `location = /admin/login/` использует ту же зону `login`, что и вход API:
  5 запросов в минуту с адреса, `burst=3`, отказ — 429 с `Retry-After: 12`.
  Бюджет общий: подбор к админке исчерпывает и вход API с того же адреса.
  Отказы в зоне `login` — штатная защита, на порог ⚠ `limit_req` не влияют.
  ⚠ поднимают только POST, дошедшие до проверки пароля (не 403 CSRF и не 429).
- `map $http_user_agent $closed_crawler` — те же роботы, что закрыты целиком
  (`Disallow: /`) в `public/robots.txt`. Они получают 403 до маршрутизации,
  кроме `/robots.txt`. Список один: закрыли робота в robots.txt — добавить его
  в map бэка тем же релизом nginx. Расхождение ловит отчёт: закрытому роботу
  «отдано» ≥50 → ⚠ со ссылкой на map.

**fail2ban для `/admin/login/` не заводим.** nginx пишет только в поток
контейнера (`docker logs`), файла для jail на хосте нет; jail и его
`logpath` на журнал Docker требуют root, а `sudo` у `sx3` с паролем. Зона
`login` уже ограничивает адрес пятью попытками в минуту, и до Django доходят
лишь они. Пересмотреть, если отчёт несколько дней подряд показывает ⚠
«дошли до проверки пароля» с одних и тех же адресов.

## Что отчёт не делает

Не блокирует адреса и роботов сам (это делают fail2ban и nginx бэка, см. выше),
не шлёт алерты чаще раза в сутки — для почты приложения это #2717, для CPU/памяти/
диска — `monitor.sh`. Связанные разборы: #1996/#2038 (fail2ban), #2189/#2720/#2823 (роботы, вход в админку).
