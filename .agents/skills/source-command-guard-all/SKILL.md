---
name: "source-command-guard-all"
description: "Guard-проверки проекта и устранение подтверждённых нарушений"
---

# source-command-guard-all

Use this skill when the user asks to run the migrated source command `guard-all`.

## Command Template

Выдели task-owned paths, сохрани чужие изменения. Проверь operation gate
`docs/WORKFLOW_OPERATIONS.md` → «3.4 Координация долгих операций», затем
прогоняй guard-скрипты по очереди и исправляй подтверждённые нарушения в scope.

```
npm run guard:external-links
npm run guard:file-complexity
npm run check:image-architecture
npm run governance:verify
```

Правила починки:
- `guard:external-links`: `Linking.openURL`/`window.open` → `@/utils/externalLinks.openExternalUrl`.
- `guard:file-complexity`: проверь нарушенный лимит; широкий распил выполняй
  только по запросу на рефакторинг, иначе укажи точный scope следующей задачи.
- `check:image-architecture`: прямой `expo-image` в фичевом коде → `components/ui/ImageCardMedia`.
- `governance:verify`: читай сообщение теста, исправляй контракт или документацию.

После code changes передай task diff на `$metravel-code-reviewer`.
В конце — список нарушений, исправлений и фактических проверок.
