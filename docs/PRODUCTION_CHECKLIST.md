# Production release checklist

Актуализировано: 2026-07-15.

Checklist описывает действия, но не подтверждает, что конкретный релиз уже
прошёл. Evidence прикладывается к release/task на MCP board.

## Authorization and target

- [ ] Явно указан target: web `dev` / `preprod` / `prod`, iOS или Android.
- [ ] Для production rollout/submit есть отдельное явное разрешение пользователя.
- [ ] Текущая ветка — `main`; working tree и scope проверены.
- [ ] Нет чужого build/deploy/test процесса или активного lock для того же target.
- [ ] Секреты читаются только из разрешённых env/secret stores и не попадают в
      вывод, screenshots или commit.

Android EAS/cloud build и submit не запускаются без явного запроса на точное
действие в текущей задаче.

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

- [ ] Deploy выполняется только project-owned release path:
  - `./build-prod.sh <target>` на машине с рабочим `rsync`;
  - documented Windows/Codex wrapper из `docs/RELEASE.md`;
  - `scripts/fix-prod.sh` только для явно запрошенного emergency recovery.
- [ ] Custom `rsync`/`scp`/SSH deploy sequence не используется.
- [ ] Production `sitemap.xml` не генерируется и не перезаписывается frontend.

## Native release

Для store-операций используй `docs/ANDROID_OWNER_GUIDE.md` и project scripts в
`package.json`.

- [ ] iOS/Android target, version/build number и store track подтверждены.
- [ ] Android closed testing соответствует `alpha`; public Production — отдельное
      решение.
- [ ] Перед Android store build пройден локальный USB device flow, если он входит
      в acceptance scope.
- [ ] Store listing, privacy, data-safety/app-access requirements проверены в
      консоли.
- [ ] Результат submit/build проверен в EAS/store, а не только по exit code CLI.

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
