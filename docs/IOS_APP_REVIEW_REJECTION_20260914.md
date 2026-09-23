# Отказ Apple 14.09.2026 — 2.1(a) «connection error» на всех способах входа

Заявка `2caaff34-ee6a-4546-b599-a27d056195dd`, кандидат MeTravel 1.0.5 (9),
сообщение Apple 14.09.2026 00:31 UTC. Review devices: iPhone 17 Pro Max и iPad Air
11-inch (M3), iOS/iPadOS 26.6.2, «Internet Connection: Active». Формулировка:
«We were unable to access the app because it returned the connection error when
we used any of the available login methods». При повторном чтении ASC
23.09.2026 обнаружены два вложения: `Screenshot-0913-172915.png` и
`Screenshot-0913-172917.png`. На iPhone показана ошибка подключения, на iPad —
такой же alert одновременно с inline-сообщением о неверном пароле. На iPad
виден индикатор VPN. Это не устанавливает тип сети или причину обрыва;
противоречивые сообщения относятся к исправлению #1944. Исходные изображения
содержат данные формы входа: не переносить их в Git или публичный ответ.

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
| DNS | A `178.172.137.129` на 1.1.1.1/8.8.8.8/9.9.9.9 и 8 узлах; **AAAA нет** (на 14.09; опубликована 19.09 — см. «Состояние сквозного IPv6») |
| IPv6 на хосте | Глобальный адрес `2a0a:7d80:3:2::186/112`, исходящий IPv6 работает; nginx слушает только IPv4 (`deploy/prod/nginx/nginx.conf:252,272,294`) |
| Логин сейчас | `POST /api/user/login/` reviewer-аккаунтом → `200` за 0,6 с |

Вывод по исследованному окну: сервер обслуживал других клиентов, а запросов,
однозначно сопоставленных с native-клиентом рецензента, не найдено.
DNS/маршрут/TLS — гипотезы, а не установленная причина. Отсутствие AAAA само
по себе не доказывает отказ в корректной DNS64/NAT64-сети. Apple сообщила
«Internet Connection: Active», но не подтвердила IPv6-only. Сквозной IPv6
и `IOS-16` нужны для проверки сетевого пути; доказательства конкретной
причины отказа по имеющимся логам и скриншотам пока нет.

Ловушка при чтении логов: `docker logs --since/--until` на хосте трактуются в
местном времени (UTC+3), а поля `time` внутри — UTC. Окно надо задавать со сдвигом.

## Состояние сквозного IPv6 на 19.09.2026

Шаг 1 плана выполнен на сервере и доказан снаружи. Backend-релиз 14.09 добавил
`listen [::]:80` и `listen [::]:443 ssl http2` на все три виртуальных хоста и
подключил nginx к dual-stack сети `metravel_metravel-ingress` (`enable_ipv6`);
внутри контейнера сокеты `[::]:80`/`[::]:443` подняты, ошибок `bind()` нет.
Внешние узлы Globalping в US/DE/PL/JP/SG по IPv6 получают `301` →
`https://metravel.by/` на :80 (apex и `www`) и `200` с валидным TLS на :443;
в access-логе nginx у каждого такого клиента реальный IPv6-адрес, а не адрес
docker-proxy, так что per-IP лимиты (`limit_req_zone`) не схлопываются; `429`
нет; IPv4 не задет (`200`). Сертификат GlobalSign выпущен вручную, ACME-продления
по IPv6 нет; маршрут IPv6 хоста статический (`accept_ra=0`). `AAAA` для
`metravel.by` и `www.metravel.by` (`2a0a:7d80:3:2::186`, TTL 600) опубликованы
19.09.2026 ~16:45 UTC в панели hoster.by (#1977, из сессии владельца с его
явного разрешения). Приёмка после публикации: авторитетные `u1/u2.hoster.by` и
1.1.1.1/8.8.8.8/9.9.9.9 отдают AAAA для apex и `www`; Globalping по имени хоста с
`ipVersion: 6` из US/DE/PL/JP → `200`, TLS authorized, resolved на IPv6-адрес,
`www` → `301`; `ipVersion: 4` → `200`; check-host.net 10/10 → `200`. Остаётся
`IOS-16` на устройстве (#1940).

Инструмент внешней IPv6-проверки: check-host.net IPv6-литералы не принимает
(`{"error":"invalid_url"}`), рабочий — Globalping API
(`POST https://api.globalping.io/v1/measurements`, `type: "http"`, target —
IPv6-адрес сервера с `request.host: "metravel.by"`, а после публикации `AAAA` —
hostname с `measurementOptions.ipVersion: 6`).

Ловушка домашнего NAT64-теста после `AAAA` (актуальна с 19.09): DNS64 по
RFC 6147 не синтезирует запись, когда реальная `AAAA` есть, и устройство пойдёт
на реальный IPv6-адрес — Mac без собственного IPv6 (как у владельца) его не
маршрутизирует. Поэтому «Create NAT64 Network» на Mac с IPv4-only провайдером
среду Apple больше не воспроизводит: сбой входа там будет артефактом стенда.
Для `IOS-16` нужна IPv6-only сеть с нативным IPv6 наверху либо dual-stack сеть,
а факт «сервер доступен по IPv6 снаружи» доказывается Globalping-пробами выше.

## Фильтрация трафика Apple на нашей стороне — проверено 19.09.2026

Решение владельца 19.09.2026: хостеру (hoster.by) ничего не пишем, трафик
режется только на нашей стороне. Вопрос про гео/ASN-фильтры у хостера снят с
#1939. Наша сторона проверена read-only на прод-хосте (SSH `sx3` без sudo;
root-only конфиги и логи — через ro-bind в одноразовом контейнере):

- ufw не включён: `/etc/ufw/ufw.conf` `ENABLED=no` с установки (03.03.2025),
  `user.rules`/`user6.rules` — пустой скелет без deny/reject, `ufw.log` нет;
  unit `ufw` «active (exited)» — oneshot, правил не грузит.
- nftables inactive, `/etc/nftables.conf` — пустой дефолтный скелет;
  `netfilter-persistent`, `/etc/iptables`, `/etc/docker/daemon.json` и
  DOCKER-USER отсутствуют.
- nginx (running conf в контейнере = `deploy/prod/nginx/nginx.conf`): ни одного
  `deny`/`allow`/`geo`/UA-блока/`return 403|444`; только `limit_req`
  (api 30r/s, login 5r/m burst 3, general 50r/s, tiles 200r/s); за окно логов
  14.09 20:10 → 19.09 17:17 UTC — ни одной строки `limiting requests … zone "login"`.
- fail2ban: единственный jail `sshd`; 1079 банов всего, из 17.0.0.0/8 — 0.
- Django: IP/geo-блоков нет, DRF-throttle только на квест-телеметрии.
- Сеть Apple доходит: 66 запросов с `17.166.x.x` (AS714) за то же окно —
  57×`200`, 9×`301`, HTTP/2, отказов нет. После `AAAA` в access-логе реальные
  IPv6-клиенты (36 за час 16 UTC и 120 за час 17 UTC 19.09).

Вывод: в перечисленных настройках и исследованном окне не найдено блокировки
сети Apple или IPv6. Это не исключает любой возможный серверный/сетевой отказ
в другое время. Письмо хостеру снято решением владельца.

## Побочная находка

`POST /api/user/apple-notifications/` от сервера Apple (server-to-server
уведомления Sign in with Apple) отклоняется `401`. Причина отказа не в этом, но
это дефект контракта Sign in with Apple — отдельная `area=back` карточка.

## Подготовка 23.09.2026 — сборка отложена до завершения todo

Решение владельца: подготовить всё до сборки; собирать после завершения задач
в `todo`. Текущая подготовка не запускает build, upload, Reply или submit.
Task-owned path: этот документ; Platform impact: iOS/iPadOS;
Localization impact: none (служебные черновики EN).

| Проверено 23.09 | Результат и граница доказательства |
| --- | --- |
| Meta / #1917 | meTravel.by — «Опубликовано», Metravel — «Подтверждено», обязательных действий нет. `email`/`public_profile` — «Готов к публикации», блокирующих требований нет; интерфейс не показывает отдельную надпись Advanced Access |
| EAS | `EXPO_PUBLIC_FACEBOOK_LOGIN_ENABLED=true` в production и preview; повторное `env:get` после записи подтвердило оба окружения. App ID совпадает с Meta и native Info.plist. Установленный build 9 от этого не меняется |
| Исходники | `main` на момент проверки — `b4383e8bf601fa914e2029c34f540c941d66b39c`, версия/build 1.0.5 (10) согласованы. Есть работающие изменения карты/планировщика; этот SHA не зафиксирован как кандидат |
| Source checks | `npm run ios:release:guard` — PASS; `npm run ios:store:guard` — PASS без проверки screenshots. Это не подпись IPA и не runtime QA |
| Live ASC | 1.0.5 (9) — «Отклонено», Guideline 2.1(a); 3 сообщения, последнее Apple от 14.09. Выбран ручной релиз. Notes — 3871 символ, содержат build 9; вложение `review-demonstration-final.mp4` относится к build 9 |

Источники состояния: [Meta](https://developers.facebook.com/apps/2443100196153960/dashboard/),
[разрешения](https://developers.facebook.com/apps/2443100196153960/use_cases/customize/?use_case_enum=FB_LOGIN),
текущая запись приложения в ASC и история #1917. Секреты и demo-credentials
остаются только в защищённых полях ASC/EAS.

Очередь `todo` на момент решения владельца:

| Задача | Обязательная проверка до подготовки финального SHA |
| --- | --- |
| #2056 — способы переезда по отрезкам маршрута | Native-маршруты и итоги, iOS Simulator по контракту задачи |
| #2071 — кластеры и активный маркер native-карты | iOS Simulator, поездка с ≥20 точками |
| #2072 — кнопки форматирования описания плана | Native TextInput selection, iOS Simulator |
| #2074 — хелперы прод-приёмки | Приёмка QA-инструментов по контракту задачи |

Это снимок, не замороженный состав релиза. Перед сборкой перечитать весь борд:
карточка, перешедшая из todo в in_progress/review/testing, ещё не завершена.
Не обходить решение владельца простым перемещением карточек между колонками.
После завершения очереди зафиксировать чистый, запушенный `main` и заново
проверить свободный build number в ASC/EAS. Номер 10 пока только плановый.

## Порядок после завершения очереди

1. Проверить итоговый SHA и обязательные проверки задач; повторить source/store
   guards и `ios:environment:check`, сверить production EAS, доступы и signing.
   Использовать tracked native project; не выполнять `expo prebuild --clean`.
2. По отдельной команде на signed build собрать кандидат через `ios-deployer`.
   Зафиксировать SHA, версию/build и EAS build ID. Затем `ios:artifact:audit`
   проверяет exact IPA: подпись, entitlements/APNs, universal family,
   purpose strings, privacy/SDK manifests, HTTPS origins и Facebook flag.
3. По отдельной команде на upload загрузить этот build ID и дождаться processing.
   TestFlight-проверка выполняется после upload, на точной обработанной сборке.
4. Пройти [матрицу IOS-01…16](MANUAL_TEST_CASES.md): iPhone/iPad, свежая установка
   и обновление с 9, гость, email/Apple/Google/Facebook success/cancel/error,
   восстановление сессии, offline/retry, Universal Links, APNs, media/share,
   удаление тестового аккаунта, RU/BE/UK/PL/EN, Dynamic Type и окна/повороты iPad.
   Для Facebook — аккаунт без роли Meta, Limited Login token/nonce, добор email
   и отсутствие ATT при обоих системных положениях Allow Apps to Request to Track.
5. `IOS-16`: свежие IPv4/IPv6-пробы из US/EU плюс вход/гость на устройстве в
   корректной IPv6-only сети и корреляция запросов с nginx-логом. Mac без
   IPv6 uplink после публикации AAAA не подходит. Обычный dual-stack прогон
   подтверждает только свой слой и не заменяет IPv6-only. При недоступном
   стенде записать точное ограничение; не объявлять pass или готовность submit.
6. Пересверить screenshots, Notes, Privacy и demo-credentials с кандидатом.
   Старый ролик build 9 можно обозначить как исторический; новое демо требует
   manifest/таймкодов и privacy review. Логин/пароль — только protected ASC fields.
7. Заменить в черновиках ниже плановые поля фактами принятого кандидата.
   Reply, App Review submit и последующий storefront release — отдельные
   операции по [релизному регламенту](RELEASE.md#ios--app-store-active-universal-iphoneipad-scope).

Статусы `done` #1918 и #1947 не доказывают будущую iOS-приёмку: последние
записи этих карточек оставили device/IPA и Dynamic Type проверки за релизом.
`artifacts/ios-qa/QA_REPORT_PREBUILD_10.md` описывает старый `bc62097bb`
со снятым APNs entitlement и без Facebook SDK; не переносить его pass на
следующую сборку. Исторические серверные пробы выше также не заменяют свежие
измерения перед submit.

## Черновик Reply (EN, подготовлен 23.09, не отправлен)

Это датированный ответ о расследовании, а не заявление об успешной проверке
нового build. После приёмки дополнить точной версией, датой и результатами
IOS-16. Скриншоты уже получены; запрашиваются диагностические детали.

```text
Thank you for the review. We investigated the connection error reported on 14 September.

We have reviewed both attached screenshots. The iPhone shows a connection error; the iPad shows a connection alert together with an incorrect-password message. We have updated the source to distinguish network failures from credential errors. This change still requires validation in the replacement release build.

Our investigation on 14 September found no identifiable native review-device requests in the server log window we examined, while other clients received successful responses. This does not establish the root cause of the review failure.

On 19 September we enabled native IPv6 for metravel.by, including AAAA records and IPv6 listeners. External checks from the US, Germany, Poland and Japan returned HTTP 200 over IPv6 with valid TLS. We found no Apple-network blocking rules in the server configuration examined that day. These historical checks do not replace testing the new candidate on the review devices' network path.

Could you share the approximate time and time zone of each sign-in attempt, the network type (IPv6-only, dual-stack or cellular), and any underlying networking error code? This will help us correlate a repeat attempt with our server logs. Thank you.
```

## Черновик Notes для следующего кандидата (EN, не сохранён в ASC)

До сохранения заменить квадратные поля проверенными фактами. Текст рассчитан
на замену Notes build 9, а не добавление к имеющимся 3871 символам. Описание
Facebook и результаты проверок оставлять только после exact-candidate pass;
автоматически отправлять этот шаблон нельзя.

```text
MeTravel is a travel guide and trip planner with travel articles, map points, city quests, favorites and personal itineraries. Public content can be browsed without signing in. Editorial content is primarily in Russian; the interface supports Russian, Belarusian, Ukrainian, Polish and English.

Candidate: [VERSION (BUILD)], tested on [IPHONE/IPAD AND OS VERSIONS] on [DATE].

Use the demo credentials in the protected App Review Information fields for email sign-in. Sign in with Apple and Google are also available. Facebook uses Meta Limited Login; its published Meta app requests only public_profile and email. [CONFIRM FACEBOOK SUCCESS WITH A NON-ROLE ACCOUNT ON THIS BUILD BEFORE RETAINING THIS SENTENCE.]

To review core features, browse a travel article and its map, open a city quest, then sign in to review favorites and a personal trip plan. Account deletion is available in Settings, in the account section. Please do not delete the reviewer demo account; deletion testing uses a separate disposable account.

The previous 1.0.5 (9) review reported a connection error. The replacement build includes differentiated network/credential errors and connection diagnostics. Our API uses https://metravel.by. [INSERT VERIFIED FRESH-INSTALL, NETWORK-RECOVERY AND IPv6-ONLY RESULTS FOR THIS EXACT BUILD.]

Facebook automatic event logging and advertiser-ID collection are disabled in the release configuration. [CONFIRM THE SIGNED IPA, RUNTIME BEHAVIOR AND APP PRIVACY ANSWERS BEFORE RETAINING THIS PARAGRAPH.] Backend authentication and content are provided by MeTravel; maps and the listed sign-in providers use their respective external services. Support: https://metravel.by/contact . Privacy: https://metravel.by/privacy .

Review demonstration: [NEW VERIFIED ATTACHMENT, DEVICE, BUILD AND SCENE TIMECODES, OR AN EXPLICIT STATEMENT THAT THE EXISTING VIDEO SHOWS BUILD 9].
```
