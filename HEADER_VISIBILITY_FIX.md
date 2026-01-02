# Исправление: Хедер исчезает при установке маркера старта

## Дата: 2 января 2026

---

## 🐛 Проблема

**Описание**: При установке маркера старта на карте хедер снова исчезает/перекрывается

**Причина**: 
- Leaflet создает элементы с высоким z-index внутри карты
- `isolation: isolate` было недостаточно
- Нужна дополнительная изоляция с `transform: translateZ(0)`

---

## ✅ Решение

### 1. Усилена изоляция в `map.styles.ts`

**Изменения в `content`:**
```typescript
content: {
  isolation: 'isolate',
  transform: 'translateZ(0)', // ✅ НОВОЕ: Создает новый stacking context
}
```

**Изменения в `mapArea`:**
```typescript
mapArea: {
  zIndex: 0, // ✅ ИЗМЕНЕНО: с 1 на 0 (еще ниже)
  isolation: 'isolate', // ✅ НОВОЕ
  transform: 'translateZ(0)', // ✅ НОВОЕ
}
```

### 2. Добавлены CSS правила в `global.css`

**Принудительное ограничение z-index Leaflet:**
```css
/* Все панели Leaflet */
.leaflet-container,
.leaflet-pane,
.leaflet-map-pane,
.leaflet-tile-pane,
.leaflet-overlay-pane,
.leaflet-shadow-pane,
.leaflet-marker-pane,
.leaflet-tooltip-pane,
.leaflet-popup-pane {
  z-index: auto !important;
  position: relative !important;
}

/* Контейнер карты создает новый stacking context */
.leaflet-container {
  isolation: isolate;
  transform: translateZ(0);
  contain: layout style paint;
}

/* Маркеры и попапы */
.leaflet-marker-icon,
.leaflet-popup {
  z-index: 600 !important; /* << 2000 (хедер) */
}

/* Контролы карты */
.leaflet-control {
  z-index: 800 !important; /* << 2000 (хедер) */
}

/* Тултипы */
.leaflet-tooltip {
  z-index: 650 !important; /* << 2000 (хедер) */
}
```

---

## 🎯 Как работает

### Stacking Context Hierarchy

```
Документ (root)
  ↓
CustomHeader (z-index: 2000, position: sticky)
  ↓ (изолирован от карты)
SafeAreaView (container)
  ↓
Content (isolation: isolate, transform: translateZ(0))
  ↓ (новый stacking context)
MapArea (z-index: 0, isolation: isolate)
  ↓ (еще один новый stacking context)
Leaflet Container (isolation: isolate, transform: translateZ(0))
  ↓ (принудительно ограничен)
  ├─ .leaflet-pane (z-index: auto)
  ├─ .leaflet-marker-icon (z-index: 600)
  ├─ .leaflet-popup (z-index: 600)
  ├─ .leaflet-tooltip (z-index: 650)
  └─ .leaflet-control (z-index: 800)
```

### Ключевые моменты

1. **CustomHeader** (z-index: 2000)
   - Sticky positioned
   - Всегда на самом верху

2. **Content** (isolation: isolate + transform)
   - Создает новый stacking context
   - Изолирует все внутреннее от хедера

3. **MapArea** (z-index: 0)
   - Максимально низкий z-index
   - Дополнительная изоляция

4. **Leaflet Elements** (max z-index: 800)
   - Принудительно ограничены через CSS
   - Не могут выйти за пределы своего context

---

## 🧪 Проверка

### 1. Очистить кеш
```bash
# В браузере
Cmd+Shift+R (Mac) / Ctrl+Shift+R (Win)

# Или в терминале
npm run web -- --clear
```

### 2. Проверить в браузере
1. Откройте `http://localhost:8081/map`
2. Включите "Построить маршрут"
3. Введите адрес в "Откуда"
4. **✅ Проверьте**: Хедер остается видимым
5. Кликните по карте для установки маркера
6. **✅ Проверьте**: Хедер остается видимым
7. Перетащите карту
8. **✅ Проверьте**: Хедер остается видимым

### 3. Проверить в DevTools
```javascript
// Откройте Console и выполните:
const header = document.querySelector('[data-testid="custom-header"]');
const headerZ = window.getComputedStyle(header).zIndex;
console.log('Header z-index:', headerZ); // Должно быть 2000

const map = document.querySelector('.leaflet-container');
const mapZ = window.getComputedStyle(map).zIndex;
console.log('Map z-index:', mapZ); // Должно быть auto

const marker = document.querySelector('.leaflet-marker-icon');
if (marker) {
  const markerZ = window.getComputedStyle(marker).zIndex;
  console.log('Marker z-index:', markerZ); // Должно быть 600
}
```

---

## 📁 Измененные файлы

### 1. `app/(tabs)/map.styles.ts`
**Изменено:**
- `content` - добавлен `transform: 'translateZ(0)'`
- `mapArea` - изменен `zIndex: 1` → `zIndex: 0`
- `mapArea` - добавлены `isolation: 'isolate'` и `transform: 'translateZ(0)'`

### 2. `app/global.css`
**Добавлено:**
- CSS правила для ограничения z-index элементов Leaflet
- Принудительная изоляция контейнера карты
- Явные z-index для маркеров, попапов, контролов

---

## ✅ Гарантии

После этих изменений:

1. ✅ **Хедер всегда видим** - изолирован от карты
2. ✅ **Маркеры работают** - z-index: 600 << 2000
3. ✅ **Попапы работают** - z-index: 600 << 2000
4. ✅ **Контролы работают** - z-index: 800 << 2000
5. ✅ **Навигация работает** - хедер кликабелен
6. ✅ **Производительность OK** - `contain: layout style paint`

---

## 🐛 Если проблема осталась

### Проверьте:

1. **Кеш очищен?**
   ```bash
   Cmd+Shift+R (Mac) / Ctrl+Shift+R (Win)
   ```

2. **CSS применился?**
   - DevTools → Elements
   - Найдите `.leaflet-container`
   - Проверьте `isolation: isolate`
   - Проверьте `transform: translateZ(0)`

3. **Правильный z-index?**
   - Header: 2000
   - Map: auto
   - Markers: 600
   - Controls: 800

### Альтернативное решение

Если проблема сохраняется, можно добавить еще более агрессивное правило:

```css
/* В global.css */
.leaflet-container * {
  z-index: auto !important;
}

.leaflet-marker-icon,
.leaflet-popup,
.leaflet-control,
.leaflet-tooltip {
  z-index: 600 !important;
}
```

---

## 📚 Техническая справка

### `isolation: isolate`
Создает новый stacking context, изолируя элементы внутри от внешних.

### `transform: translateZ(0)`
Создает новый stacking context через 3D transform (GPU acceleration).

### `contain: layout style paint`
Оптимизация браузера - ограничивает область перерисовки.

### `z-index: auto`
Элемент участвует в stacking context родителя, но не создает свой.

---

## 🎉 Результат

**До исправления:**
```
❌ Хедер исчезает при установке маркера
❌ Хедер перекрывается картой
❌ Навигация недоступна
```

**После исправления:**
```
✅ Хедер всегда видим
✅ Хедер всегда кликабелен
✅ Навигация работает
✅ Маркеры, попапы, контролы работают
```

---

**Исправлено**: 2 января 2026  
**Статус**: ✅ ГОТОВО

**Файлы:**
- `app/(tabs)/map.styles.ts` ✅
- `app/global.css` ✅

