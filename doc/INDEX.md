# Documentation Index

> Single source of truth: **all project documentation lives only in `doc/`**. Add any new docs here.

## Start here

- [Development](./DEVELOPMENT.md)
- [Release](./RELEASE.md)
- [Troubleshooting](./TROUBLESHOOTING.md)

## Product specs

 - [Travel Details Performance (TZ)](./travel-details-performance-tz.md)

## What lives where

- App entry and routing: `app/` (Expo Router)
- UI components: `components/`
- Business logic / services: `src/`
- Cross-cutting utilities: `utils/`
- Tests: `__tests__/`

## Contributing hygiene

- Prefer dev-only logging via `src/utils/logger.ts` helpers.
- Keep web console clean in production builds.
- For web-rendered UI, avoid SVG icon stacks (`react-native-svg`, `lucide-react-native`); prefer `@expo/vector-icons`.
