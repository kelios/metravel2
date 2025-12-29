# Troubleshooting

## Expo / Metro

- Cache issues:

```bash
npm run clean
```

## Web

- If you see dev-only banners/logs, ensure you are using production build/export where applicable.
- If you see runtime errors related to `Svg` / `parseTransformProp`, avoid SVG icon libraries (`react-native-svg`, `lucide-react-native`) in web-rendered components and use `@expo/vector-icons` instead.
  - Then restart with a clean cache: `npm run reset`.

## Tests

- Run: `npm run test`.
- If a suite hangs: run with `--detectOpenHandles`.
