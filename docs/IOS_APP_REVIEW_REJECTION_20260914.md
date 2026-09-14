# Отказ Apple 14.09.2026 — 2.1(a) «connection error» на всех способах входа

Заявка `2caaff34-ee6a-4546-b599-a27d056195dd`, кандидат MeTravel 1.0.5 (9),
сообщение Apple 14.09.2026 00:31 UTC. Review devices: iPhone 17 Pro Max и iPad Air
11-inch (M3), iOS/iPadOS 26.6.2, «Internet Connection: Active». Формулировка:
«We were unable to access the app because it returned the connection error when
we used any of the available login methods». Скриншотов и вложений нет.

## Что установлено (read-only, 14.09.2026 07:00–08:30 UTC)

| Проверка | Результат |
| --- | --- |
| nginx прода, окно 23:30–01:00 UTC 14.09 | 833 ответа `200`, 101 `301`, 90 `404`; ни одной `5xx`/`444`/`429`; 364 разных IP |
| Запросы с сети Apple (`17.x`) в окне | Один: 00:32:05 UTC `POST /api/user/apple-notifications/` с 17.58.58.24 (UA `Java`) → `401` |
| Запросы native-клиента (`metravel/9 CFNetwork`) не с IP владельца | Ноль за всё окно |
| Последний успешный вход из среды App Review | 12.09 21:43 UTC, 17.185.64.73, `POST /api/user/login/` → `200`, профиль user 120 загружен (UA `metravel/9 CFNetwork Darwin/25.5`) |
| Контейнеры | nginx up с 11.09; app пересоздан 01:00:08 UTC 14.09 (после письма), health `healthy`, OOM нет |
| `/health` 503 | Короткие серии 12:42, 19:09, 19:36, 21:11 UTC 13.09 (рестарты воркеров), вне окна проверки |
| Достижимость снаружи (check-host.net) | US×3, CA, UK, DE, PL, CY, HK, UA → HTTP `200`, 0,18–1,9 с |
| DNS | A `178.172.137.129` на 1.1.1.1/8.8.8.8/9.9.9.9 и 8 узлах; **AAAA нет** |
| IPv6 на хосте | Глобальный адрес `2a0a:7d80:3:2::186/112`, исходящий IPv6 работает; nginx слушает только IPv4 (`deploy/prod/nginx/nginx.conf:252,272,294`) |
| Логин сейчас | `POST /api/user/login/` reviewer-аккаунтом → `200` за 0,6 с |

Вывод: в окно проверки сервер был жив и доступен из внешнего мира, а от устройств
рецензента не пришло ни одного запроса. Обрыв произошёл до нашего сервера —
DNS/маршрут/TLS-соединение из сети App Review. Единственный непроверенный нами
путь — IPv6-only (NAT64) сеть Apple: метravel.by не имеет AAAA и не слушает IPv6,
всё держится на трансляции NAT64 у Apple. Из логов постфактум причина не
доказывается; сквозной IPv6 и обязательный тест `IOS-16` убирают эту зависимость.

Ловушка при чтении логов: `docker logs --since/--until` на хосте трактуются в
местном времени (UTC+3), а поля `time` внутри — UTC. Окно надо задавать со сдвигом.

## Побочная находка

`POST /api/user/apple-notifications/` от сервера Apple (server-to-server
уведомления Sign in with Apple) отклоняется `401`. Причина отказа не в этом, но
это дефект контракта Sign in with Apple — отдельная `area=back` карточка.

## План

1. Сквозной IPv6 (`area=back`, порядок строгий): `listen [::]:80` и
   `listen [::]:443 ssl http2` в nginx → проверка `curl -6` снаружи → AAAA
   `2a0a:7d80:3:2::186` у hoster.by (владелец).
2. `IOS-16` на exact-кандидате: iPad/iPhone в NAT64-сети Mac Internet Sharing —
   гость, email-вход, Apple, Google; запросы устройства видны в nginx-логе.
3. Ответ Apple с фактами и запросом скриншота/типа сети (отдельное разрешение
   владельца), затем повторный submit (отдельное разрешение).
4. В следующий кандидат: причина ошибки соединения в UI (код/host), #1895.

## Черновик Reply (EN, ~1 500 символов, не отправлен)

```text
Thank you for the review. We investigated the connection error reported on 14 September.

1. Our production API was up throughout the review window (23:30–01:00 UTC): it served 833 successful responses to other clients with no server errors, and it is reachable from US, Canada, UK and EU test nodes (HTTP 200, 0.2–0.8 s). Email sign-in with the reviewer demo account returns 200 today.
2. Our server logs contain no requests at all from the review devices in that window — no guest catalogue loads and no sign-in attempts — so the failure occurred before the request reached our server. On 12 September at 21:43 UTC a sign-in from the App Review network completed successfully with the same build and account.
3. To rule out an IPv6-only network path, we are enabling native IPv6 on metravel.by (AAAA record and IPv6 listeners) and re-testing the exact build on an IPv6-only NAT64 network before resubmitting.

Could you share a screenshot of the error and confirm the network type (Wi-Fi IPv6-only or cellular) and the time of the attempt? Thank you.
```
