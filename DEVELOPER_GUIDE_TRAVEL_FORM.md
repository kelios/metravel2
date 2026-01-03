# Руководство по безопасной работе с формой путешествий

## 🎯 Быстрый старт для разработчиков

### Основные правила

#### 1. ✅ Всегда используйте `cleanAndSave` вместо прямого API вызова
```typescript
// ❌ ПЛОХО
await saveFormData(formData);

// ✅ ХОРОШО
await cleanAndSave(formData);
```

#### 2. ✅ Отменяйте автосейв перед ручным сохранением
```typescript
const handleManualSave = async () => {
  autosave?.cancelPending?.(); // Отменяем pending автосейв
  const savedData = await cleanAndSave(formData);
  autosave?.updateBaseline?.(savedData); // Обновляем baseline
};
```

#### 3. ✅ Проверяйте `mountedRef` перед setState в async функциях
```typescript
const loadData = async () => {
  const data = await fetchData();
  
  if (!mountedRef.current) {
    return; // Компонент размонтирован, не обновляем state
  }
  
  setData(data);
};
```

#### 4. ✅ Нормализуйте draft placeholders перед отображением
```typescript
// ❌ ПЛОХО
setFormData(savedData);

// ✅ ХОРОШО
const normalizedData = normalizeDraftPlaceholders(savedData);
setFormData(normalizedData);
```

#### 5. ✅ Проверяйте доступ перед редактированием
```typescript
const canEdit = checkTravelEditAccess(travel, userId, isSuperAdmin);
if (!canEdit) {
  // Показываем ошибку и блокируем редактирование
  return;
}
```

---

## 🚫 Типичные ошибки и как их избежать

### Ошибка #1: Race Condition при автосохранении
```typescript
// ❌ ПЛОХО - может привести к race condition
const save1 = saveFormData(data1);
const save2 = saveFormData(data2);
await Promise.all([save1, save2]);

// ✅ ХОРОШО - автоматическая отмена предыдущего запроса
await cleanAndSave(data1);
await cleanAndSave(data2); // Предыдущий запрос отменен
```

### Ошибка #2: Memory Leak при размонтировании
```typescript
// ❌ ПЛОХО
useEffect(() => {
  loadData().then(data => {
    setState(data); // Может вызваться после размонтирования
  });
}, []);

// ✅ ХОРОШО
useEffect(() => {
  let mounted = true;
  loadData().then(data => {
    if (mounted) {
      setState(data);
    }
  });
  return () => { mounted = false; };
}, []);
```

### Ошибка #3: Отправка невалидных данных
```typescript
// ❌ ПЛОХО
const nextForm = { ...formData, publish: true };
await onManualSave(nextForm);

// ✅ ХОРОШО - валидация перед отправкой
const validation = validateModerationRequirements(formData);
if (!validation.isValid) {
  showErrors(validation.missingFields);
  return;
}
const nextForm = { ...formData, publish: true };
await onManualSave(nextForm);
```

---

## 🔧 Полезные утилиты

### `cleanEmptyFields(obj)`
Очищает пустые строки, заменяя их на `null`:
```typescript
const cleaned = cleanEmptyFields({
  name: "Test",
  description: "",
  countries: []
});
// { name: "Test", description: null, countries: [] }
```

### `normalizeTravelId(id)`
Нормализует ID к числу или `null`:
```typescript
normalizeTravelId("123") // 123
normalizeTravelId("abc") // null
normalizeTravelId(null)  // null
```

### `syncCountriesFromMarkers(markers, countries)`
Синхронизирует страны из маркеров с существующим списком:
```typescript
const markers = [{ country: "1", ... }, { country: "2", ... }];
const countries = ["3"];
const synced = syncCountriesFromMarkers(markers, countries);
// ["3", "1", "2"]
```

### `validateModerationRequirements(formData)`
Проверяет готовность к модерации:
```typescript
const { isValid, missingFields } = validateModerationRequirements(formData);
if (!isValid) {
  console.log("Отсутствуют поля:", missingFields);
}
```

---

## 🎨 Примеры использования

### Создание нового путешествия
```typescript
import { useAuth } from '@/context/AuthContext';
import { useTravelFormData } from '@/hooks/useTravelFormData';

function CreateTravel() {
  const { userId, isSuperAdmin, isAuthenticated } = useAuth();
  
  const {
    formData,
    setFormData,
    autosave,
    handleManualSave,
  } = useTravelFormData({
    travelId: null,
    isNew: true,
    userId,
    isSuperAdmin,
    isAuthenticated,
    authReady: true,
  });
  
  const handleSubmit = async () => {
    await handleManualSave();
    // Навигация после успешного сохранения
  };
  
  return (
    <form onSubmit={handleSubmit}>
      {/* Поля формы */}
      <button type="submit">Сохранить</button>
      {autosave.status === 'saving' && <span>Сохранение...</span>}
    </form>
  );
}
```

### Редактирование существующего путешествия
```typescript
function EditTravel({ travelId }) {
  const { userId, isSuperAdmin, isAuthenticated, authReady } = useAuth();
  
  const {
    formData,
    setFormData,
    isInitialLoading,
    hasAccess,
    autosave,
    handleManualSave,
  } = useTravelFormData({
    travelId,
    isNew: false,
    userId,
    isSuperAdmin,
    isAuthenticated,
    authReady,
  });
  
  if (isInitialLoading) {
    return <Loader />;
  }
  
  if (!hasAccess) {
    return <AccessDenied />;
  }
  
  return (
    <form>
      {/* Поля формы */}
      <AutosaveIndicator status={autosave.status} />
    </form>
  );
}
```

### Отправка на модерацию
```typescript
function PublishStep({ formData, onManualSave }) {
  const handleSendToModeration = async () => {
    // Валидация
    const validation = validateModerationRequirements(formData);
    if (!validation.isValid) {
      setErrors(validation.missingFields);
      return;
    }
    
    // Отмена автосейва
    autosave?.cancelPending?.();
    
    // Обновление статуса
    const nextForm = {
      ...formData,
      publish: true,
      moderation: false,
    };
    
    // Сохранение
    await onManualSave(nextForm);
    
    // Навигация
    router.push('/metravel');
  };
  
  return (
    <button onClick={handleSendToModeration}>
      Отправить на модерацию
    </button>
  );
}
```

---

## 🧪 Тестирование

### Тест race condition
```typescript
it('should cancel previous save when new save starts', async () => {
  const { result } = renderHook(() => useTravelFormData({...}));
  
  // Запускаем два сохранения подряд
  const save1 = result.current.handleManualSave();
  const save2 = result.current.handleManualSave();
  
  // Первое должно быть отменено
  await expect(save1).rejects.toThrow('AbortError');
  
  // Второе должно успешно завершиться
  await expect(save2).resolves.toBeDefined();
});
```

### Тест memory leak
```typescript
it('should not update state after unmount', async () => {
  const { result, unmount } = renderHook(() => useTravelFormData({...}));
  
  // Запускаем async операцию
  const promise = result.current.handleManualSave();
  
  // Размонтируем до завершения
  unmount();
  
  // Не должно быть ошибок
  await expect(promise).resolves.toBeDefined();
});
```

---

## 📚 Дополнительные ресурсы

- [TRAVEL_CRUD_ANALYSIS.md](./TRAVEL_CRUD_ANALYSIS.md) - Полный анализ
- [TRAVEL_CRUD_FIXES_SUMMARY.md](./TRAVEL_CRUD_FIXES_SUMMARY.md) - Резюме исправлений
- [API Documentation](./docs/api/) - Документация API

---

## 🆘 Часто задаваемые вопросы

**Q: Почему автосохранение не срабатывает?**
A: Проверьте, что `autosave.enabled` равно `true` и пользователь авторизован.

**Q: Как отключить автосохранение для конкретного поля?**
A: Используйте локальный state и обновляйте formData только при blur.

**Q: Что делать, если данные не сохраняются?**
A: Проверьте консоль на ошибки валидации и network tab для API ошибок.

**Q: Как обработать конфликт версий?**
A: Пока версионирование не реализовано. Используйте оптимистичные блокировки.

---

**Последнее обновление:** 3 января 2026

