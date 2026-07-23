---
name: "source-command-guard-all"
description: "Прогон всех guard-скриптов проекта"
---

# source-command-guard-all

Use this skill when the user asks to run the migrated source command `guard-all`.

## Command Template

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
