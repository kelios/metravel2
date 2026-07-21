# Production release checklist

Актуализировано: 2026-07-17.

Checklist описывает действия, но не подтверждает, что конкретный релиз уже
прошёл. Evidence прикладывается к release/task на MCP board.

## Authorization and target

- [ ] Явно указан активный target: web `dev` / `preprod` / `prod` или Android.
- [ ] Для production rollout/submit есть отдельное явное разрешение пользователя.
- [ ] Текущая ветка — `main`; working tree и scope проверены.
- [ ] Нет чужого build/deploy/test процесса или активного lock для того же target.
- [ ] Для каждой разрешённой server-write операции выполнены read-only
      `git status --short` и `git ls-files --error-unmatch -- <repo-relative-path>`; ни один
      intended path не является Git-tracked.
- [ ] Production backend checkout не содержит tracked changes, неизвестных
      untracked entries или неожиданных warnings. Из gate исключены только
      `deploy/prod/nginx/ssl/`, `dump.sql` и permission warning для
      `deploy/prod/postgis_1/data/`; эти paths не читаются и не изменяются.
      Любое другое отклонение останавливает deploy/pull/cleanup и фиксируется в
      `area=back`/ops задаче для backend owner.
- [ ] Секреты читаются только из разрешённых env/secret stores и не попадают в
      вывод, screenshots или commit.

Android EAS/cloud build и submit запрещены. Android собирается локальным Gradle,
а Play API automation может менять только `production`; closed-testing tracks,
testers и countries защищены.

## Pre-release gate

- [ ] Запущен единый gate:

  ```bash
  npm run release:check
  ```

  Он включает lint, typecheck, security checks, dependency audit, Jest, E2E,
  production web build и bundle/eager-web guards под общим quality lock.

- [ ] Если scope требует отдельной governance-проверки:

  ```bash
  npm run governance:verify
  ```

- [ ] External-link policy проверена каноническим alias:

  ```bash
  npm run guard:external-links
  ```

  Canonical command reference: `docs/TESTING.md#governance-commands`.

- [ ] Падения разобраны и исправлены; skipped/unrun проверки не выданы за pass.
- [ ] Для travel hero/slider/details отдельно выполнены обе стороны контракта:

  ```bash
  npm run verify:slider
  npm run verify:slider-perf
  ```

  Запуск — через общий quality-gate wrapper по правилам `AGENTS.md`.

## Web artifact and deploy

- [ ] Production artifact создан канонической командой:

  ```bash
  npm run build:web:prod
  ```

- [ ] Build-only preview при необходимости:

  ```bash
  DEPLOY=0 ./build-prod.sh prod
  ```

- [ ] Транспорт заливки проверен под машину: `rsync --version | head -1` = GNU rsync, protocol >= 30
      (на macOS — Homebrew `/opt/homebrew/bin/rsync`). Системный `openrsync` (protocol 29) молча
      заливает неполный артефакт и бьёт прод — им НЕ деплоить. См. `docs/RELEASE.md`.
- [ ] Deploy выполняется только project-owned release path:
  - `./build-prod.sh <target>` на машине с рабочим GNU `rsync` (обычный путь на macOS);
  - ops-wrapper из `docs/RELEASE.md` — только на историческом Windows/Codex-чекауте, на macOS его нет;
  - `scripts/fix-prod.sh` только для явно запрошенного emergency recovery.
- [ ] Custom `rsync`/`scp`/SSH deploy sequence не используется.
- [ ] Server writes ограничены документированными untracked frontend targets
      (`static/dist*`); tracked backend source/config не изменяется, не
      backup'ится внутри checkout и не очищается.
- [ ] Production `sitemap.xml` не генерируется и не перезаписывается frontend.

## Android release

Для store-операций используй `docs/ANDROID_OWNER_GUIDE.md` и project scripts в
`package.json`.

- [ ] Android target, version/build number и store track подтверждены.
- [ ] Android target — `production`; `alpha`, `internal`, `beta`, testers,
      countries и текущий closed test не меняются.
- [ ] Перед Android store build пройден локальный USB device flow, если он входит
      в acceptance scope.
- [ ] Store listing, privacy, data-safety/app-access requirements проверены в
      консоли.
- [ ] Локальный AAB подписан upload-key, совпадающим с сертификатом Play, а
      versionCode совпадает с `app.json`.
- [ ] Dry-run `npm run android:submit:latest` прошёл validate и удалил временный
      edit; commit выполняется только `npm run android:submit:production`.
- [ ] Результат Android submit проверен в Play, а не только по exit code CLI.
- [ ] Если владелец отдельно запросил обновление closed/internal testing,
      использованы только `android:submit:testing:latest` →
      `android:submit:testing`; после commit подтверждены `alpha`/`internal`, а
      `production`/`beta`, тестировщики и страны не изменились.

## Post-deploy

- [ ] Production health и основные routes отвечают без white screen/5xx.
- [ ] SEO smoke:

  ```bash
  npm run test:seo:postdeploy
  ```

- [ ] Raw HTML содержит ожидаемые title/description/canonical/robots/OG/JSON-LD.
- [ ] Analytics запускается только после consent.
- [ ] Console/network не содержат новых критических ошибок.
- [ ] Fresh performance измеряется по реальному URL; budget и throttling method
      берутся из `config/lighthouse-budget-mobile.json` и scripts:

  ```bash
  npm run lighthouse:produrl:travel:mobile -- --url https://metravel.by/travels/<slug>
  npm run guard:lighthouse:mobile:fail
  ```

- [ ] Не возвращён service-worker runtime/static cache и нет инструкции
      пользователю очищать кэш.

## Handoff

- [ ] Указаны target, commit/artifact/version и время релиза.
- [ ] Перечислены реально запущенные команды и результаты.
- [ ] Приложены production/browser/device evidence по scope.
- [ ] Residual risks и blockers сформулированы явно.
- [ ] Board task обновлён только после выполнения его Task Contract/Done gate.

Подробности deploy path и rollback: `docs/RELEASE.md`.
