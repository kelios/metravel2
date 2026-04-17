---
description: Прогон всех guard-скриптов проекта
allowed-tools: Bash(npm run guard:*), Bash(npm run check:image-architecture), Bash(npm run governance:verify)
---

Прогоняй guard-скрипты по очереди и чини найденное.

```
npm run guard:external-links
npm run guard:file-complexity
npm run check:image-architecture
npm run governance:verify
```

Правила починки:
- `guard:external-links`: `Linking.openURL`/`window.open` → `@/utils/externalLinks.openExternalUrl`.
- `guard:file-complexity`: файл >800 LOC — распили по доменам, не прячь нарушение.
- `check:image-architecture`: прямой `expo-image` в фичевом коде → `components/ui/ImageCardMedia`.
- `governance:verify`: читай сообщение теста, исправляй контракт или документацию.

В конце — список что было нарушено и что исправлено.
