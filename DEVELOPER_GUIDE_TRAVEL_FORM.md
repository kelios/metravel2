# Руководство разработчика MeTravel

## 📍 УЛУЧШЕНИЯ КАРТЫ (Январь 2026)

### ✅ Phase 1: Quick Wins (ЗАВЕРШЕНО - 3 января 2026)

#### 1. Расстояние и время в пути ✅
**Статус**: Production Ready  
**Файлы**: 
- `utils/distanceCalculator.ts` - утилиты расчета
- `components/MapPage/AddressListItem.tsx` - визуализация
- `__tests__/utils/distanceCalculator.test.ts` - тесты (17/17 passed ✅)

**Использование**:
```typescript
import { getDistanceInfo } from '@/utils/distanceCalculator';

const info = getDistanceInfo(
  { lat: userLat, lng: userLng },
  { lat: placeLat, lng: placeLng },
  'car' // or 'bike', 'foot'
);

// info.distanceText: "2.5 км"
// info.travelTimeText: "3 мин"
```

#### 2. Умные рекомендации "Популярное рядом" ✅
**Файлы**: `components/MapPage/QuickRecommendations.tsx`

**Использование в FiltersPanel**:
```typescript
<QuickRecommendations
  places={travelsData}
  userLocation={coordinates}
  transportMode="car"
  onPlaceSelect={handleSelect}
  maxItems={3}
/>
```

#### 3. Сохранение предпочтений ✅
**Файлы**: `src/utils/mapFiltersStorage.ts`

**Расширенный интерфейс**:
```typescript
interface MapFilterValues {
  categories: string[];
  radius: string;
  address: string;
  transportMode?: 'car' | 'bike' | 'foot'; // НОВОЕ
  lastMode?: 'radius' | 'route'; // НОВОЕ
}
```

---

### ✅ Phase 2: Мобильные улучшения (ЗАВЕРШЕНО - 3 января 2026)

**Платформы**: iOS, Android (нативные)  
**Библиотеки**: @gorhom/bottom-sheet, react-native-gesture-handler

#### 1. Bottom Sheet панель ✅
**Статус**: Production Ready  
**Файлы**: `components/MapPage/MapBottomSheet.tsx`

Заменяет боковую панель на мобильных устройствах (iOS/Android).

**Особенности**:
- 3 состояния: collapsed (10%), half (50%), full (90%)
- Peek preview с топ-3 местами
- Плавные анимации
- Backdrop для full состояния

**Использование**:
```typescript
import MapBottomSheet, { type MapBottomSheetRef } from '@/components/MapPage/MapBottomSheet';

const ref = useRef<MapBottomSheetRef>(null);

<MapBottomSheet
  ref={ref}
  title="Места рядом"
  subtitle="15 мест"
  peekContent={<MapPeekPreview places={places} />}
  onStateChange={(state) => console.log(state)}
>
  {children}
</MapBottomSheet>

// Управление:
ref.current?.snapToCollapsed();
ref.current?.snapToHalf();
ref.current?.snapToFull();
```

#### 2. Floating Action Button (FAB) ✅
**Файлы**: `components/MapPage/MapFAB.tsx`

Быстрый доступ к главным действиям.

**Использование**:
```typescript
<MapFAB
  mainAction={{
    icon: 'menu',
    label: 'Меню',
    onPress: handleMenuPress,
  }}
  actions={[
    { icon: 'my-location', label: 'Моё местоположение', onPress: centerOnUser },
    { icon: 'filter-list', label: 'Фильтры', onPress: openFilters },
    { icon: 'route', label: 'Построить маршрут', onPress: buildRoute },
  ]}
  position="bottom-right"
/>
```

#### 3. Swipeable жесты ✅
**Файлы**: `components/MapPage/SwipeableListItem.tsx`

Свайпы на элементах списка (только на нативных платформах).

**Жесты**:
- Свайп влево → Добавить/убрать из избранного
- Свайп вправо → Построить маршрут сюда

**Использование**:
```typescript
<SwipeableListItem
  onFavorite={() => toggleFavorite(item.id)}
  onBuildRoute={() => buildRoute(item)}
  showFavorite={true}
  showRoute={true}
  isFavorite={favorites.has(item.id)}
>
  <AddressListItem travel={item} />
</SwipeableListItem>
```

#### 4. Peek Preview ✅
**Файлы**: `components/MapPage/MapPeekPreview.tsx`

Быстрый просмотр топ-3 мест в collapsed состоянии.

**Использование**:
```typescript
<MapPeekPreview
  places={travelsData}
  userLocation={coordinates}
  transportMode="car"
  onPlacePress={handlePlacePress}
  onExpandPress={() => bottomSheetRef.current?.snapToHalf()}
/>
```

#### 5. Мобильный Layout ✅
**Файлы**: `components/MapPage/MapMobileLayout.tsx`

Объединяет все мобильные компоненты.

**Автоматическое переключение**:
```typescript
// В map.tsx
const useMobileLayout = isMobile && Platform.OS !== 'web';

if (useMobileLayout) {
  return <MapMobileLayout {...props} />;
}

// Иначе используется классический десктопный layout
```

---

### 📦 Установленные библиотеки

```json
{
  "@gorhom/bottom-sheet": "^5.0.0",
  "react-native-gesture-handler": "^2.14.1"
}
```

**Важно**: `react-native-gesture-handler` должен быть импортирован в `entry.js` **в самом начале**:
```javascript
import 'react-native-gesture-handler';
```

---

### 📋 Phase 3: Следующие шаги
- [ ] Skeleton Loaders вместо спиннеров
- [ ] Аналитика событий (map_filter_used, place_clicked, swipe_gesture)
- [ ] Кластеризация маркеров
- [ ] Онбординг для новых пользователей
- [ ] Haptic feedback для свайпов
- [ ] Long press на карте → контекстное меню

---

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

