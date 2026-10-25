# Ежедневный security-отчёт прод-хоста (#2721)

Каждое утро в 09:10 по времени хоста (Europe/Minsk) cron пользователя `sx3`
собирает сводку безопасности за последние 24 часа и шлёт письмом на адрес из
конфига (по умолчанию тот же, что у SEO-отчёта). Тема письма:
`Security report metravel.by DD.MM.YYYY: OK` либо `N ⚠` — число отклонений.

## Что в письме

| раздел | источник на хосте | что считается |
| --- | --- | --- |
| SSH | `/var/log/auth.log*`, `/var/log/fail2ban.log*` | неудачные попытки (одно соединение sshd — одна попытка) и адреса, `Found`, баны по jail `sshd` / `sshd-slow` / `recidive`, восстановленные баны, топ атакующих, успешные входы (⚠ если адрес не из своих) |
| Web | `docker logs metravel-nginx-1` за окно (JSON access + stderr) | внешние запросы без своих адресов, статусы, сканеры (`.env`, `.git`, `wp-*`, `*.php`), `POST /admin/login/`, срабатывания `limit_req` по чужим адресам, 5xx по путям, топ сетей `/24` / `/48` |
| Роботы | `user_agent` против `https://metravel.by/robots.txt` | запросов по каждому роботу, разделы сайта, пометка «закрыт в robots.txt», ⚠ если закрытый робот всё равно ходит (≥50 запросов) |
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
bash scripts/enable-prod-security-report.sh --run-now  # собрать и отправить сейчас
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

## Что отчёт не делает

Не блокирует адреса и роботов (fail2ban и nginx принадлежат бэку и владельцу),
не шлёт алерты чаще раза в сутки — для почты приложения это #2717, для CPU/памяти/
диска — `monitor.sh`. Связанные разборы: #1996/#2038 (fail2ban), #2189/#2720 (роботы).
