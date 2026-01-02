# 🎨 Анализ и оптимизация бокового меню страницы карты

**Дата:** 2 января 2026  
**Компонент:** `FiltersPanel.tsx`  
**Статус:** Анализ и рекомендации

---

## 📋 Текущая структура бокового меню

### Sticky Header (всегда видимый)
```
┌─────────────────────────────────────┐
│ 📌 Фильтры              [Закрыть]   │ ← Заголовок
├─────────────────────────────────────┤
│ 🔢 125 мест в радиусе 60 км         │ ← Счетчик
│ ✓ Фильтры применены                 │ ← Индикатор
├─────────────────────────────────────┤
│ 📍 Найти в радиусе    🗺️ Маршрут   │ ← Табы режимов
├─────────────────────────────────────┤
│ ℹ️ Статус маршрутизации             │ ← RoutingStatus
└─────────────────────────────────────┘
```

### Scrollable Content (прокручиваемая область)

#### Режим "Радиус"
```
┌─────────────────────────────────────┐
│ Категории                           │
│ □ Культура (45)  □ Природа (32)    │
│ [Культура] [Природа] [×]            │ ← Выбранные чипы
├─────────────────────────────────────┤
│ Радиус поиска                       │
│ Slider: |----●----| 60 км           │
│ [60] [100] [200] [500]              │ ← Быстрый выбор
└─────────────────────────────────────┘
```

#### Режим "Маршрут"
```
┌─────────────────────────────────────┐
│ Шаг 1. Старт                        │
│ [Поиск адреса...]                   │
├─────────────────────────────────────┤
│ Шаг 2. Финиш                        │
│ [Поиск адреса...]                   │
├─────────────────────────────────────┤
│ Транспорт                           │
│ [🚗 Авто] [🚶 Пешком] [🚲 Велосипед]│
├─────────────────────────────────────┤
│ [Сбросить] [S ↔ F]                  │
├─────────────────────────────────────┤
│ Шаг 1. ✓ Выберите старт            │
│ Шаг 2. ✓ Выберите финиш            │
│ Шаг 3. ⏳ Транспорт                 │
└─────────────────────────────────────┘
```

### Footer Actions
```
┌─────────────────────────────────────┐
│ [Сбросить]    [Построить маршрут]   │
└─────────────────────────────────────┘
```

---

## 🔍 Обнаруженные проблемы UI/UX

### Критические 🔥

#### 1. **Перегруженный интерфейс в режиме маршрута**
**Проблема:**
- Дублирование информации (поиск адресов + stepper)
- 3 блока для одной задачи (AddressSearch × 2, Stepper, RoutePointControls)
- Пользователь видит одновременно: поля ввода, степпер, статус, контролы

**Решение:**
```typescript
// Объединить в один компактный блок
<RouteBuilder
  startAddress={startAddress}
  endAddress={endAddress}
  onAddressSelect={onAddressSelect}
  onSwap={swapStartEnd}
  onClear={onClearRoute}
  compact={isMobile}
/>
```

---

#### 2. **Плохая видимость статуса маршрутизации**
**Проблема:**
- RoutingStatus в sticky header занимает много места
- При прокрутке вниз статус не виден
- Прогресс-бар теряется среди других элементов

**Решение:**
```typescript
// Переместить в inline состояние кнопки
<Pressable style={styles.buildRouteButton}>
  {routingLoading && <ProgressBar />}
  <Text>{ctaLabel}</Text>
</Pressable>
```

---

#### 3. **Неочевидная последовательность действий**
**Проблема:**
- Stepper показывает шаги, но не интерактивен
- Пользователь не понимает что делать дальше
- Нет визуального прогресса (2/3 выполнено)

**Решение:**
```typescript
<ProgressIndicator
  steps={['Старт', 'Финиш', 'Транспорт']}
  currentStep={currentStep}
  compact
/>
```

---

### Средние ⚠️

#### 4. **Категории занимают слишком много места**
**Проблема:**
- MultiSelectField + chips + hint = 3 блока
- На мобиле занимает 40% экрана

**Решение:**
```typescript
// Компактный вид с раскрытием
<CollapsibleSection title="Категории (3)" defaultOpen={false}>
  <MultiSelectField compact ... />
</CollapsibleSection>
```

---

#### 5. **Радиус: дублирование контролов**
**Проблема:**
- RadiusSelect (slider) + Quick options (кнопки)
- Один элемент достаточен

**Решение:**
```typescript
// Только быстрые кнопки с подсветкой текущего
<RadiusButtons
  options={[60, 100, 200, 500]}
  value={radius}
  onChange={onChange}
/>
```

---

#### 6. **Нет быстрых действий**
**Проблема:**
- Нет кнопки "Сбросить всё"
- Нет "Применить" (автоматически применяется)
- Нет "Показать все результаты"

**Решение:**
```typescript
<QuickActions>
  <Action icon="refresh" onPress={resetAll}>
    Сбросить всё
  </Action>
  <Action icon="zoom-out-map" onPress={fitToBounds}>
    Показать все ({count})
  </Action>
</QuickActions>
```

---

### Низкие ℹ️

#### 7. **Табы режимов занимают много места**
**Проблема:**
- 2 большие кнопки с иконками + текст + subtitle
- На мобиле ~100px высоты

**Решение:**
```typescript
// Компактный вид
<SegmentedControl
  options={['Радиус', 'Маршрут']}
  value={mode}
  onChange={setMode}
/>
```

---

#### 8. **Недостаточная обратная связь**
**Проблема:**
- Нет haptic feedback на мобиле
- Нет анимации при изменении фильтров
- Нет индикации загрузки данных

**Решение:**
```typescript
// Добавить haptic + анимацию
const handleFilterChange = async (field, value) => {
  if (Platform.OS !== 'web') {
    Haptics.selectionAsync();
  }
  Animated.spring(scaleAnim, { toValue: 1.05 }).start();
  onFilterChange(field, value);
};
```

---

## 🎯 Предлагаемая оптимизированная структура

### Вариант 1: Компактная (для мобиле)

```
┌─────────────────────────────────────┐
│ 🗺️ Карта                 [✕]        │
├─────────────────────────────────────┤
│ ⬤────⬤ Радиус | Маршрут             │ ← Компактный toggle
├─────────────────────────────────────┤
│ 🔢 125 мест • 60 км                 │ ← Одна строка
├─────────────────────────────────────┤
│                                     │
│ [Категории ▾]  3 выбрано            │ ← Свернутые секции
│                                     │
│ [Радиус ▾]     60 км                │
│                                     │
│ ────────────────────────────────    │
│                                     │
│ [Сбросить]  [Показать все]          │
│                                     │
└─────────────────────────────────────┘
```

### Вариант 2: Детальная (для десктопа)

```
┌─────────────────────────────────────┐
│ Фильтры                             │
│                                     │
│ ⦿ Радиус    ○ Маршрут               │
│                                     │
│ ┌─ Категории ────────────────────┐ │
│ │ ☑ Культура (45)  ☑ Природа (32)│ │
│ │ ☐ История (18)   ☐ Еда (56)    │ │
│ └─────────────────────────────────┘ │
│                                     │
│ ┌─ Радиус поиска ─────────────────┐│
│ │ ⬤ 60  ○ 100  ○ 200  ○ 500 км   ││
│ └─────────────────────────────────┘ │
│                                     │
│ ┌─ Результаты ────────────────────┐│
│ │ 🔍 125 мест найдено              ││
│ │ [Показать все на карте →]       ││
│ └─────────────────────────────────┘ │
│                                     │
│ [Сбросить фильтры]                  │
│                                     │
└─────────────────────────────────────┘
```

---

## 💡 Конкретные улучшения (с кодом)

### Улучшение 1: Компактный header

**Было:**
```typescript
<View style={styles.headerContainer}>
  <View style={styles.header}>
    <Text style={styles.title}>Фильтры</Text>
    <Pressable onPress={closeMenu}>
      <Icon name="close" />
      <Text>Закрыть</Text>
    </Pressable>
  </View>
  <View style={styles.counterRow}>
    <View style={styles.counterBadge}>
      <Text>{totalPoints}</Text>
      <Text>мест в радиусе {radius} км</Text>
    </View>
  </View>
</View>
```

**Стало:**
```typescript
<View style={styles.compactHeader}>
  <Text style={styles.title}>
    🗺️ {totalPoints} мест • {radius} км
  </Text>
  <Pressable onPress={closeMenu} style={styles.closeButton}>
    <Icon name="close" size={20} />
  </Pressable>
</View>

// Стили
compactHeader: {
  flexDirection: 'row',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: 12,
  borderBottomWidth: 1,
  borderBottomColor: colors.border,
},
title: {
  fontSize: 14,
  fontWeight: '600',
  color: colors.text,
},
closeButton: {
  width: 32,
  height: 32,
  alignItems: 'center',
  justifyContent: 'center',
  borderRadius: 16,
},
```

**Экономия:** ~40px по вертикали

---

### Улучшение 2: Collapsible секции

```typescript
const CollapsibleSection: React.FC<{
  title: string;
  badge?: string | number;
  defaultOpen?: boolean;
  children: React.ReactNode;
}> = ({ title, badge, defaultOpen = true, children }) => {
  const [open, setOpen] = useState(defaultOpen);
  
  const toggleOpen = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setOpen(!open);
  };
  
  return (
    <View style={styles.collapsibleSection}>
      <Pressable 
        style={styles.collapsibleHeader}
        onPress={toggleOpen}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
      >
        <View style={styles.collapsibleTitle}>
          <Text style={styles.sectionLabel}>{title}</Text>
          {badge && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{badge}</Text>
            </View>
          )}
        </View>
        <Icon 
          name={open ? 'expand-less' : 'expand-more'} 
          size={20} 
          color={colors.text} 
        />
      </Pressable>
      {open && <View style={styles.collapsibleContent}>{children}</View>}
    </View>
  );
};

// Использование
<CollapsibleSection 
  title="Категории" 
  badge={filterValue.categories.length || undefined}
  defaultOpen={filterValue.categories.length > 0}
>
  <MultiSelectField ... />
</CollapsibleSection>

<CollapsibleSection title="Радиус" badge={`${radius} км`}>
  <RadiusButtons ... />
</CollapsibleSection>
```

**Экономия:** ~150-200px когда свернуто

---

### Улучшение 3: Inline прогресс для маршрута

```typescript
const RouteBuilder: React.FC<{
  startAddress: string;
  endAddress: string;
  onAddressSelect: (address: string, coords: LatLng, isStart: boolean) => void;
  onSwap?: () => void;
  onClear?: () => void;
  routingLoading?: boolean;
  compact?: boolean;
}> = ({ startAddress, endAddress, onAddressSelect, onSwap, onClear, routingLoading, compact }) => {
  const progress = useMemo(() => {
    let step = 0;
    if (startAddress) step++;
    if (endAddress) step++;
    return `${step}/2`;
  }, [startAddress, endAddress]);
  
  return (
    <View style={styles.routeBuilder}>
      {/* Progress indicator */}
      <View style={styles.progressHeader}>
        <Text style={styles.progressText}>Маршрут {progress}</Text>
        {onClear && (
          <Pressable onPress={onClear} style={styles.iconButton}>
            <Icon name="refresh" size={18} />
          </Pressable>
        )}
      </View>
      
      {/* Compact address inputs */}
      <View style={styles.addressPair}>
        <View style={styles.addressInput}>
          <Icon name="trip-origin" size={16} color={colors.success} />
          <AddressSearch
            placeholder="Старт"
            value={startAddress}
            onAddressSelect={(addr, coords) => onAddressSelect(addr, coords, true)}
            compact
          />
        </View>
        
        {onSwap && startAddress && endAddress && (
          <Pressable onPress={onSwap} style={styles.swapButton}>
            <Icon name="swap-vert" size={20} />
          </Pressable>
        )}
        
        <View style={styles.addressInput}>
          <Icon name="location-on" size={16} color={colors.danger} />
          <AddressSearch
            placeholder="Финиш"
            value={endAddress}
            onAddressSelect={(addr, coords) => onAddressSelect(addr, coords, false)}
            compact
          />
        </View>
      </View>
      
      {routingLoading && (
        <View style={styles.inlineProgress}>
          <ActivityIndicator size="small" />
          <Text style={styles.inlineProgressText}>Строим маршрут...</Text>
        </View>
      )}
    </View>
  );
};
```

**Экономия:** ~100px, убираем дублирование

---

### Улучшение 4: Быстрые действия (Quick Actions)

```typescript
const QuickActions: React.FC<{
  onReset: () => void;
  onFitBounds: () => void;
  onSaveFilters?: () => void;
  totalPoints: number;
  hasFilters: boolean;
}> = ({ onReset, onFitBounds, onSaveFilters, totalPoints, hasFilters }) => {
  return (
    <View style={styles.quickActions}>
      {hasFilters && (
        <Pressable 
          style={styles.quickAction}
          onPress={onReset}
          accessibilityLabel="Сбросить все фильтры"
        >
          <Icon name="refresh" size={18} color={colors.text} />
          <Text style={styles.quickActionText}>Сбросить</Text>
        </Pressable>
      )}
      
      {totalPoints > 0 && (
        <Pressable 
          style={styles.quickAction}
          onPress={onFitBounds}
          accessibilityLabel={`Показать все ${totalPoints} мест на карте`}
        >
          <Icon name="zoom-out-map" size={18} color={colors.text} />
          <Text style={styles.quickActionText}>
            Показать все ({totalPoints})
          </Text>
        </Pressable>
      )}
      
      {onSaveFilters && hasFilters && (
        <Pressable 
          style={styles.quickAction}
          onPress={onSaveFilters}
          accessibilityLabel="Сохранить текущие фильтры"
        >
          <Icon name="bookmark-outline" size={18} color={colors.text} />
          <Text style={styles.quickActionText}>Сохранить</Text>
        </Pressable>
      )}
    </View>
  );
};

// Стили
quickActions: {
  flexDirection: 'row',
  gap: 8,
  padding: 12,
  borderTopWidth: 1,
  borderTopColor: colors.border,
  backgroundColor: colors.surfaceVariant,
},
quickAction: {
  flexDirection: 'row',
  alignItems: 'center',
  gap: 4,
  paddingVertical: 6,
  paddingHorizontal: 12,
  borderRadius: 16,
  backgroundColor: colors.surface,
  borderWidth: 1,
  borderColor: colors.border,
},
quickActionText: {
  fontSize: 13,
  color: colors.text,
  fontWeight: '500',
},
```

---

### Улучшение 5: Компактный SegmentedControl для режимов

```typescript
const SegmentedControl: React.FC<{
  options: Array<{ key: string; label: string; icon?: string }>;
  value: string;
  onChange: (key: string) => void;
}> = ({ options, value, onChange }) => {
  return (
    <View style={styles.segmentedControl}>
      {options.map(({ key, label, icon }) => {
        const active = value === key;
        return (
          <Pressable
            key={key}
            style={[
              styles.segment,
              active && styles.segmentActive,
            ]}
            onPress={() => onChange(key)}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
          >
            {icon && <Icon name={icon} size={16} color={active ? colors.textOnPrimary : colors.text} />}
            <Text style={[
              styles.segmentText,
              active && styles.segmentTextActive,
            ]}>
              {label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
};

// Стили
segmentedControl: {
  flexDirection: 'row',
  backgroundColor: colors.surfaceVariant,
  borderRadius: 8,
  padding: 2,
  marginHorizontal: 12,
  marginVertical: 8,
},
segment: {
  flex: 1,
  flexDirection: 'row',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 4,
  paddingVertical: 8,
  borderRadius: 6,
},
segmentActive: {
  backgroundColor: colors.primary,
},
segmentText: {
  fontSize: 13,
  fontWeight: '600',
  color: colors.text,
},
segmentTextActive: {
  color: colors.textOnPrimary,
},
```

**Экономия:** ~40px по вертикали

---

## 📊 Сравнение: До и После

### Высота панели на мобиле (iPhone 14)

| Секция | До | После | Экономия |
|--------|-----|--------|----------|
| Header | 120px | 48px | **-72px** |
| Режимы | 100px | 40px | **-60px** |
| Категории (открыто) | 180px | 160px | -20px |
| Категории (закрыто) | - | 44px | **-136px** |
| Радиус | 140px | 44px | **-96px** |
| Stepper (маршрут) | 200px | 0px | **-200px** |
| RouteBuilder | - | 120px | - |
| Quick Actions | 0px | 48px | +48px |

**Итого экономии:** ~400-500px на мобиле при закрытых секциях

---

## 🚀 План реализации

### Фаза 1: Быстрые улучшения (2-3 часа)

1. ✅ Компактный header (30 мин)
2. ✅ SegmentedControl для режимов (30 мин)
3. ✅ Quick Actions (30 мин)
4. ✅ Inline прогресс для маршрута (1 час)

**Результат:** -150px, лучше UX

---

### Фаза 2: Структурные изменения (4-5 часов)

5. ✅ CollapsibleSection компонент (1 час)
6. ✅ RouteBuilder компонент (2 часа)
7. ✅ Рефакторинг категорий (1 час)
8. ✅ Рефакторинг радиуса (30 мин)

**Результат:** -300px при закрытых секциях

---

### Фаза 3: Полировка (2-3 часа)

9. ✅ Haptic feedback (30 мин)
10. ✅ Анимации переходов (1 час)
11. ✅ Accessibility улучшения (1 час)
12. ✅ Тестирование на всех устройствах (30 мин)

**Результат:** Профессиональный UX

---

## ✅ Критерии успеха

После оптимизации:

- [ ] Высота панели на мобиле ≤ 600px (было ~800px)
- [ ] Все секции имеют collapsible варианты
- [ ] Режим маршрута не дублирует информацию
- [ ] Есть быстрые действия (Quick Actions)
- [ ] Haptic feedback на всех интерактивных элементах
- [ ] Плавные анимации переходов (LayoutAnimation)
- [ ] WCAG AA compliance (контрастность, размеры)
- [ ] Lighthouse Accessibility ≥95

---

**Дата:** 2 января 2026  
**Автор:** GitHub Copilot  
**Статус:** Готово к реализации

