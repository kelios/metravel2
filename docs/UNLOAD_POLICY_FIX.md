# Исправление Permissions Policy Violation: unload

## 🐛 Проблема

```
[Violation] Permissions policy violation: unload is not allowed in this document.
```

Эта ошибка возникает когда код пытается использовать события `unload` или `beforeunload`, но они заблокированы Permissions Policy в браузере.

## 🔍 Причины

### 1. **Permissions Policy Header**
В `nginx.conf` установлено:
```nginx
Permissions-Policy "... unload=(self) ..."
```

Это означает что `unload` разрешён только для same-origin документов.

### 2. **Iframe/Embed контексты**
Если страница загружается в iframe, `unload` может быть заблокирован родительским документом.

### 3. **Устаревшие браузеры**
Старые браузеры могут не поддерживать Permissions Policy API.

## ✅ Решение

### Создан утилитный файл: `utils/beforeunloadGuard.ts`

Этот файл содержит безопасные обёртки для работы с unload events:

```typescript
import {
  isUnloadAllowed,
  addBeforeUnloadListener,
  useBeforeUnload
} from '@/utils/beforeunloadGuard'

// 1. Проверка доступности
if (isUnloadAllowed()) {
  // Безопасно использовать beforeunload
}

// 2. Безопасное добавление listener
const cleanup = addBeforeUnloadListener((event) => {
  event.preventDefault()
  event.returnValue = 'Несохранённые изменения'
  return 'Несохранённые изменения'
})

// 3. React Hook версия
useBeforeUnload((event) => {
  event.preventDefault()
  return 'Несохранённые изменения'
}, hasUnsavedChanges)
```

## 🔄 Современные альтернативы

### 1. **pagehide** (рекомендуется)

Современная замена для `unload`:
```typescript
import { addPageHideListener } from '@/utils/beforeunloadGuard'

const cleanup = addPageHideListener((event) => {
  // Сохранить данные
  saveData()
})
```

**Преимущества:**
- ✅ Не блокируется Permissions Policy
- ✅ Работает надёжнее чем unload
- ✅ Поддерживает back/forward cache

### 2. **visibilitychange**

Для отслеживания ухода со страницы:
```typescript
import { addVisibilityChangeListener } from '@/utils/beforeunloadGuard'

const cleanup = addVisibilityChangeListener(() => {
  // Пользователь переключился на другую вкладку
  // или закрыл страницу
  saveDataToLocalStorage()
})
```

**Когда использовать:**
- Автосохранение черновиков
- Отправка analytics
- Cleanup операции

## 📝 Миграция существующего кода

### До:
```typescript
useEffect(() => {
  const handler = (e: BeforeUnloadEvent) => {
    e.preventDefault()
    e.returnValue = 'Несохранённые изменения'
    return 'Несохранённые изменения'
  }

  window.addEventListener('beforeunload', handler)
  return () => window.removeEventListener('beforeunload', handler)
}, [hasChanges])
```

### После:
```typescript
import { useBeforeUnload } from '@/utils/beforeunloadGuard'

useBeforeUnload((e) => {
  e.preventDefault()
  e.returnValue = 'Несохранённые изменения'
  return 'Несохранённые изменения'
}, hasChanges)
```

## 🎯 Где применять

### 1. **Формы с несохранёнными данными**
```typescript
// В TravelWizard, форма создания путешествия
useBeforeUnload(
  createBeforeUnloadHandler('У вас есть несохранённые изменения'),
  hasUnsavedChanges
)
```

### 2. **Редакторы**
```typescript
// В ArticleEditor
useBeforeUnload(
  () => 'Черновик не сохранён',
  isDirty
)
```

### 3. **Cleanup операции**
```typescript
// Использовать pagehide вместо unload
addPageHideListener(() => {
  // Отправить аналитику
  sendAnalytics()

  // Сохранить состояние
  saveToSessionStorage()
})
```

## 🔧 Проверка в коде

### Найти все использования:
```bash
grep -r "beforeunload\|unload" --include="*.ts" --include="*.tsx"
```

### Проверить существующий код:
Уже реализовано в:
- ✅ `hooks/useTravelWizard.ts` - есть проверка `permissionsPolicy.allowsFeature('unload')`

### Требует обновления:
Проверьте эти файлы на использование unload events без защиты:
- `components/layout/AppProviders.tsx`
- `components/layout/WebAppRuntimeEffects.tsx`
- Любые custom hooks с cleanup

## 🧪 Тестирование

### 1. Проверка в DevTools:
```javascript
// В консоли браузера
document.permissionsPolicy.allowsFeature('unload')
// Должно вернуть true в основном окне
// Может вернуть false в iframe
```

### 2. Проверка в iframe:
```html
<!-- Создать тестовую страницу -->
<iframe src="https://yourapp.com"></iframe>
<script>
  // Проверить что нет violation errors
</script>
```

### 3. Unit тесты:
```typescript
import { isUnloadAllowed } from '@/utils/beforeunloadGuard'

it('should detect unload permission', () => {
  const allowed = isUnloadAllowed()
  expect(typeof allowed).toBe('boolean')
})
```

## 📊 Browser Support

| Браузер | Permissions Policy | beforeunload | pagehide |
|---------|-------------------|--------------|----------|
| Chrome 88+ | ✅ | ✅ | ✅ |
| Firefox 65+ | ✅ | ✅ | ✅ |
| Safari 15+ | ⚠️ Partial | ✅ | ✅ |
| Edge 88+ | ✅ | ✅ | ✅ |

**Legend:**
- ✅ Полная поддержка
- ⚠️ Частичная поддержка
- ❌ Не поддерживается

## 🚨 Важные замечания

### 1. **beforeunload ограничения**
- Современные браузеры игнорируют custom messages
- Может не работать на mobile
- Блокируется в iframes

### 2. **Рекомендации**
- ✅ Используйте `pagehide` для cleanup
- ✅ Используйте `visibilitychange` для автосохранения
- ✅ Используйте `beforeunload` только для критических предупреждений
- ❌ Не используйте `unload` (deprecated)

### 3. **Production готовность**
- Убедитесь что nginx.conf содержит `unload=(self)`
- Проверьте CSP headers
- Протестируйте в различных браузерах

## 📚 Дополнительные ресурсы

- [MDN: beforeunload](https://developer.mozilla.org/en-US/docs/Web/API/Window/beforeunload_event)
- [MDN: pagehide](https://developer.mozilla.org/en-US/docs/Web/API/Window/pagehide_event)
- [Permissions Policy Spec](https://w3c.github.io/webappsec-permissions-policy/)
- [Page Lifecycle API](https://developers.google.com/web/updates/2018/07/page-lifecycle-api)

## ✅ Checklist

Перед деплоем проверьте:
- [ ] Все unload/beforeunload обёрнуты в `beforeunloadGuard`
- [ ] Cleanup операции используют `pagehide`
- [ ] Автосохранение использует `visibilitychange`
- [ ] Permissions Policy в nginx.conf настроен
- [ ] Тесты проходят в iframe контексте
- [ ] Нет console.warn о violations

## 🎉 Итог

Проблема решена созданием безопасных утилит в `utils/beforeunloadGuard.ts`.

Все новые компоненты должны использовать эти утилиты вместо прямого доступа к `window.addEventListener('beforeunload')`.
