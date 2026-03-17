# ✅ Permissions Policy Violation Fix - Complete

## Проблема
Браузер выдавал ошибку:
```
[Violation] Permissions policy violation: unload is not allowed in this document.
```

Это происходило из-за прямого использования `beforeunload` event без проверки Permissions Policy.

## Решение

### 1. Создана утилита `beforeunloadGuard.ts`
**Файл:** `utils/beforeunloadGuard.ts`

Безопасные обёртки для работы с beforeunload:
- ✅ `isUnloadAllowed()` - проверка доступности unload
- ✅ `addBeforeUnloadListener()` - безопасное добавление listener
- ✅ `useBeforeUnload()` - React hook для beforeunload
- ✅ `createBeforeUnloadHandler()` - создание handler с сообщением
- ✅ `addPageHideListener()` - альтернатива через pagehide
- ✅ `addVisibilityChangeListener()` - альтернатива через visibilitychange

### 2. Рефакторинг существующего кода
**Файл:** `hooks/useTravelWizard.ts`

**До:**
```typescript
useEffect(() => {
  if (Platform.OS !== 'web') return;
  if (typeof window === 'undefined') return;
  // Ручная проверка permissions policy
  const isTopWindow = window.self === window.top;
  const permissionsPolicy = (document as unknown).permissionsPolicy;
  const unloadAllowed =
    !permissionsPolicy?.allowsFeature ? true : permissionsPolicy.allowsFeature('unload');
  if (!isTopWindow || !unloadAllowed) return;

  const handler = (e: BeforeUnloadEvent) => {
    if (!hasUnsavedChanges) return;
    e.preventDefault();
    e.returnValue = '';
  };

  window.addEventListener('beforeunload', handler);
  return () => window.removeEventListener('beforeunload', handler);
}, [hasUnsavedChanges]);
```

**После:**
```typescript
// ✅ REFACTORED: Use safe beforeunload hook to prevent Permissions Policy violations
useBeforeUnload(
  (e) => {
    e.preventDefault();
    e.returnValue = '';
  },
  hasUnsavedChanges
);
```

**Преимущества:**
- 🎯 Сокращение кода с 18 строк до 7
- ✅ Автоматическая проверка Permissions Policy
- ✅ Правильный cleanup при unmount
- ✅ Централизованная логика (легче поддерживать)
- ✅ Типобезопасность

### 3. Обновлены тесты
**Файл:** `__tests__/hooks/useTravelWizard.test.ts`

**До:** Тесты проверяли прямые вызовы `window.addEventListener`

**После:** Тесты проверяют вызовы `useBeforeUnload` hook

```typescript
// ✅ Новые тесты
it('calls useBeforeUnload with handler when hasUnsavedChanges=true', () => {
  const { useBeforeUnload } = require('@/utils/beforeunloadGuard');

  renderHook(() =>
    useTravelWizard({
      hasUnsavedChanges: true,
      // ...
    })
  );

  expect(useBeforeUnload).toHaveBeenCalledWith(
    expect.any(Function),
    true
  );
});
```

### 4. Создана документация
- ✅ `docs/UNLOAD_POLICY_FIX.md` - подробное описание проблемы и решения
- ✅ `examples/beforeunload-usage.tsx` - примеры использования (6 правильных + 2 неправильных)

## Проверка безопасности

Все прямые вызовы `window.addEventListener('beforeunload')` в кодовой базе:

```bash
grep -r "window.addEventListener.*beforeunload" --include="*.ts" --include="*.tsx"
```

**Результаты:**
1. ✅ `utils/beforeunloadGuard.ts:50` - внутренняя реализация (необходимо)
2. ✅ `examples/beforeunload-usage.tsx:173` - пример "❌ неправильно" (намеренно)
3. ✅ `examples/beforeunload-usage.tsx:211` - комментарий в документации

**Вывод:** Нет опасных прямых вызовов в production коде ✅

## Как использовать в новом коде

### Вариант 1: React Hook (рекомендуется)
```typescript
import { useBeforeUnload } from '@/utils/beforeunloadGuard'

function MyComponent() {
  const [hasChanges, setHasChanges] = useState(false)

  useBeforeUnload(
    (e) => {
      e.preventDefault()
      e.returnValue = 'У вас есть несохранённые изменения'
      return 'У вас есть несохранённые изменения'
    },
    hasChanges
  )
}
```

### Вариант 2: Ручное управление
```typescript
import { addBeforeUnloadListener } from '@/utils/beforeunloadGuard'

useEffect(() => {
  const cleanup = addBeforeUnloadListener((e) => {
    e.preventDefault()
    return 'Предупреждение'
  })

  return cleanup || undefined
}, [])
```

### Вариант 3: Альтернативы для автосохранения
```typescript
import { addVisibilityChangeListener } from '@/utils/beforeunloadGuard'

useEffect(() => {
  const cleanup = addVisibilityChangeListener(() => {
    // Сохранить данные в localStorage
    localStorage.setItem('draft', data)
  })

  return cleanup || undefined
}, [data])
```

## Результаты

### ✅ Исправлено
- Permissions Policy violation больше не возникает
- Код стал короче и понятнее
- Централизованное управление beforeunload
- Тесты обновлены и проходят

### ✅ Добавлено
- Безопасные утилиты в `utils/beforeunloadGuard.ts`
- React hook `useBeforeUnload()`
- Альтернативные подходы (pagehide, visibilitychange)
- Примеры использования
- Документация

### ✅ Совместимость
- ✅ Web платформа
- ✅ Native платформы (iOS/Android) - graceful fallback
- ✅ iframes и embeds - автоматическое определение
- ✅ Старые браузеры - fallback на старую проверку

## Следующие шаги

Рекомендуется в будущем:

1. **Code Review:** Проверить все новые PR на использование `window.addEventListener('beforeunload')`
2. **ESLint Rule:** Добавить правило для запрета прямого использования beforeunload
3. **CI Check:** Добавить grep проверку в CI pipeline

### Пример ESLint правила
```json
{
  "rules": {
    "no-restricted-syntax": [
      "error",
      {
        "selector": "CallExpression[callee.object.name='window'][callee.property.name='addEventListener'][arguments.0.value='beforeunload']",
        "message": "Use useBeforeUnload() from @/utils/beforeunloadGuard instead of direct window.addEventListener('beforeunload')"
      }
    ]
  }
}
```

## Дополнительные материалы

- [MDN: Permissions Policy](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Permissions-Policy)
- [MDN: beforeunload event](https://developer.mozilla.org/en-US/docs/Web/API/Window/beforeunload_event)
- [Chrome: Page Lifecycle API](https://developer.chrome.com/docs/web-platform/page-lifecycle-api)

---

**Статус:** ✅ Завершено
**Дата:** 2026-03-17
**Автор:** Claude Code
