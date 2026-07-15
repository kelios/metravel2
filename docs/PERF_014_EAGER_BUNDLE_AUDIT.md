# Web eager-bundle guard contract

Актуализировано: 2026-07-15.

Документ хранит current load-bearing contract бывшей PERF-014, а не historical
bundle audit. Свежие byte/module numbers принимаются только из нового
`ANALYZE_BUNDLE=1` production export.

## Problem boundary

Статический root import `react-native-gesture-handler` способен втянуть в
общий web eager graph gesture-handler, Reanimated, worklets и Hammer, даже если
web runtime не использует этот native path. Route-level lazy boundaries не
компенсируют vendor code, уже попавший в entry/shared graph.

## Current implementation

- `metro.config.js` на web резолвит bare
  `react-native-gesture-handler` в
  `metro-stubs/react-native-gesture-handler.js`;
- branch защищён `DISABLE_GH_STUB !== '1'`;
- native resolution не меняется;
- web code, которому действительно нужен Reanimated, импортирует его в своей
  lazy/feature boundary;
- `ANALYZE_BUNDLE=1` включает serializer probe, который читает module graph и
  пишет analysis dump, не меняя emitted output.

Opt-out нужен только для отдельного доказанного web gesture contract. Нельзя
постоянно задавать `DISABLE_GH_STUB=1` в `package.json`, `eas.json` или
`app.json`.

## Regression guard

`scripts/guard-eager-web-bundle.js` предоставляет:

- `npm run guard:eager-web` — static report;
- `npm run guard:eager-web:fail` — static blocking mode;
- `npm run guard:eager-web:analyze` — blocking analysis свежего Metro dump.

Static mode проверяет resolver branch, полноту stub exports и отсутствие
committed opt-out. Analyze mode реконструирует synchronous eager graph и
проверяет forbidden vendor packages и общий budget.

Forbidden set и default threshold принадлежат самому guard script. Числа не
дублируются как «текущий baseline» в документации.

## Fresh analysis

```bash
ANALYZE_BUNDLE=1 npm run build:web:prod
npm run guard:eager-web:analyze
```

Перед production export проверь operation gate и общий web-build lock. В evidence
запиши commit, build command, dump path, total eager size и package offenders без
копирования секретов/env values.

Helper scripts в `.codex-temp/bundle/` — ignored diagnostics, не canonical
tooling. Guard script и tests остаются source of truth.

## Safe-change rules

- Изменение Metro resolver/stub требует static guard и production export.
- Новый named import из gesture-handler должен поддерживаться stub либо иметь
  отдельный web implementation.
- Нельзя объявлять passthrough/no-op приемлемым без browser interaction check для
  затронутой feature.
- Web optimization не должна менять Android/iOS module resolution.
- Bundle improvement подтверждается fresh artifact, а не dev request count.
- Budget повышается только после review причины и сравнимого production baseline.

## Validation

Минимальный scope:

- `__tests__/scripts/perf014-gh-stub-guard.test.ts`;
- `npm run guard:eager-web:fail`;
- `npm run build:web:prod` и `npm run guard:eager-web:analyze` для
  resolver/vendor graph changes;
- browser smoke затронутых map/quest/travel gestures;
- native smoke, если изменён общий или native import path.

`release:check` включает static eager guard и bundle budget, но fresh analyze
остаётся отдельным artifact-dependent measurement.

Исторический аудит 2026-06 объяснил появление stub и guard. Его моментальные
module counts, sign-off status и browser run results удалены как неактуальные;
история доступна в git.
