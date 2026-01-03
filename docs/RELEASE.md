# Release / deployment guide

## Project root

- Current project: `metravel2`
- Run all commands from the `metravel2/` app root (this folder contains `package.json`).

## One-command pre-release check

```bash
npm run release:check
```

It runs:

- `npm run lint`
- `./verify-security-fixes.sh`
- `npm run audit:high`
- `npm run test:run`
- `npm run build:web`

## Web build

```bash
npm run build:web
```

(Expo export for web)

## Mobile builds (EAS)

See scripts in `package.json`:

### iOS

```bash
npm run ios:prebuild
npm run ios:build:prod
npm run ios:submit:latest
```

### Android

```bash
npm run android:prebuild
npm run android:build:prod
npm run android:submit:latest
```

## Secrets / credentials

See `PRODUCTION_CHECKLIST.md`.

- Do not commit production secrets into `.env.*`.
- Configure secrets in EAS.
