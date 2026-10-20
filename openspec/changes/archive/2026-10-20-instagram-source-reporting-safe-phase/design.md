## Context

Мотивация и границы — в proposal.md. Измерение #2659 использует GA4 sessionDefaultChannelGroup и собственный знаменатель sessions. Собственный traffic_source сейчас присутствует не во всех событиях вклада автора, поэтому отчёт использует нативные sessionSource/sessionMedium. Их API-контракт: https://developers.google.com/analytics/devguides/reporting/data/v1/api-schema.

## Goals / Non-Goals

Сделать независимый разрез источников в CLI и месячной сводке. Классификатор, клиентский транспорт и реальные ссылки Instagram сохраняются до завершения #2659 по выбору владельца.

## Decisions

1. Переиспользовать runReport/allRows, календарь ресурса и отдельные отчёты месячной сводки. Один pure helper хранит три имени событий, формы запросов, признаки Instagram и сборку строк/качества для обоих CLI. Дублировать агрегацию в двух командах не будем.
2. Запрашивать sessions по source/medium, eventCount — отдельным запросом по source/medium/eventName; в месячной сводке добавить yearMonth. Совместный запрос sessions с eventName отвергнут: не даёт независимого числа сессий. Existing Unassigned-запросы не меняются.
3. Сохранять сырые source/medium; Instagram помечать только для точных instagram/instagram.com/l.instagram.com/www.instagram.com. Алиасы не суммируются как независимый канальный итог. Facebook и неизвестные источники остаются различимы.
4. JSON получает sourceBreakdown и месячный разрез с source/medium, sessions и тремя nullable eventCount. При отсутствии Instagram видна строка без наблюдений. Недоступность, неполнота и ограничения качества отделены от отсутствия строки. Срабатывания не называются уникальными регистрациями или конверсией.
5. Новые отчёты месячной сводки изолированы в общем дедлайне с AbortSignal; их отказ не уничтожает старые totals/channels/events. Токены и полные HTTP-тела ошибок не выводятся.

## Ownership / Validation

scripts/fetch-ga4-stats.js, scripts/lib/ga4-source-breakdown.js, scripts/lib/metrics-summary.js, scripts/lib/metrics-summary-sources.js и соответствующие scripts tests — CLI-исполнитель. docs/INSTAGRAM_OPERATIONS.md, docs/INSTAGRAM_CONTENT_SPEC.md, docs/GROWTH_PLAN.md и этот change — основная сессия. Чужие SEO-правки не входят.

Platform/localization: none, UI/web/native не затронуты. Browser/device/build/deploy не доказывают локальный CLI-контракт и не требуются. После source checks и независимого review: commit/push в main и в testing живые stats:ga4 --channel-breakdown --days 7 и stats:summary; проверить данные/качество/секреты и сохранность старого отчёта.

## Risks / Trade-offs

- Дополнительные Data API запросы → пагинация и общий дедлайн сохраняются.
- Thresholding, sampling и отсутствующие события → явные null/статусы/метаданные, без оценки по неполным строкам. См. https://developers.google.com/analytics/devguides/reporting/data/v1/reporting-data-expectations.
- Замер #2659 → read-only сбор; клиентские файлы, UTM-продюсеры и профиль Instagram не меняются.

## Migration Plan

Добавочные JSON-поля совместимы с текущими итогами. Выпуск — коммит CLI/docs в main; откат — revert этого коммита. Смена ссылки владельцем и выкат классификатора остаются в #2680 после #2659.
