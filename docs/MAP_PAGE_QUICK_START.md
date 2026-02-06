# Карта MeTravel — Quick Start для рефакторинга

> **Дата:** 6 февраля 2026  
> **Время чтения:** 5 минут  
> **Полное ТЗ:** `MAP_PAGE_REFACTORING_SPEC.md`

---

## 🎯 Главные проблемы

### 1. 🧠 Когнитивная перегрузка
Пользователь видит слишком много контролов одновременно → не понимает, с чего начать.

**Решение:** Progressive disclosure — показываем опции постепенно.

---

### 2. 📱 Bottom Sheet конфликтует с картой
На мобильном Bottom Sheet перекрывает контролы zoom.

**Решение:** Сдвигаем контролы вверх или переносим их в левый верхний угол.

---

### 3. 🔇 Нет обратной связи
При построении маршрута, изменении фильтров — нет подтверждения.

**Решение:** Toast-уведомления для ключевых действий.

---

### 4. 🚀 Нет onboarding
Новые пользователи не понимают, как работает карта.

**Решение:** Интерактивный тур при первом визите (3 шага).

---

### 5. 📊 Список мест — однообразие
Все карточки одинаковые, сложно ориентироваться в длинном списке.

**Решение:** Группировка по расстоянию + компактные карточки.

---

## ✅ P1 Checklist (2 недели)

### Week 1

- [ ] **Bottom Sheet collision fix**
  - Файл: `components/MapPage/MapMobileLayout.tsx`
  - Действие: Добавить динамический `padding-bottom` для контролов карты
  - Тест: Bottom Sheet в состоянии `half` не закрывает zoom

- [ ] **Toast notifications**
  - Файл: `utils/toast.ts`
  - Действие: Создать функцию `showMapToast(type, message)`
  - Интеграция: Добавить в `MapScreen.tsx` для действий:
    - Построение маршрута
    - Сброс фильтров
    - Центрирование на пользователе

- [ ] **Error states улучшение**
  - Файл: `components/ui/ErrorDisplay.tsx`
  - Действие: Добавить prop `illustration` (путь к изображению)
  - Действие: Дружелюбные сообщения вместо технических

- [ ] **Tabs визуальное улучшение**
  - Файл: `components/MapPage/SegmentedControl.tsx`
  - Действие: Добавить badge с количеством для вкладки "Список"
  - Стиль: Подчёркивание снизу вместо fill background

---

### Week 2

- [ ] **Progressive disclosure фильтров**
  - Файл: `components/MapPage/FiltersPanelBody.tsx`
  - Действие: Разделить на Primary (всегда видны) + Secondary (collapsed)
  - Primary: Радиус, Категория, Транспорт
  - Secondary: Теги, Автор, Даты, Сложность
  - UI: Кнопка "Больше фильтров" с badge активных secondary

- [ ] **Bottom Sheet анимация**
  - Файл: `components/MapPage/MapBottomSheet.tsx`
  - Действие: Заменить `Animated` на `react-native-reanimated`
  - Анимация: Spring animation при snap

- [ ] **Onboarding для карты**
  - Файл: `components/MapPage/MapOnboarding.tsx` (новый)
  - Шаги:
    1. "Здесь отображаются места"
    2. "Используйте фильтры"
    3. "Или постройте маршрут"
  - Показать 1 раз (localStorage)

- [ ] **Когнитивная нагрузка — анализ**
  - Действие: A/B тест progressive disclosure vs всё открыто
  - Метрика: Конверсия в построение маршрута

---

## 🎨 Визуальная структура (улучшенная)

### Desktop — Before

```
┌───────────────┬─────────────────────┐
│ ФИЛЬТРЫ       │ КАРТА               │
│ ├ Радиус      │ ┌─────────────────┐ │
│ ├ Категория   │ │ Map              │ │
│ ├ Теги        │ │                  │ │
│ ├ Автор       │ │ Controls (R):    │ │
│ ├ Даты        │ │ +/- zoom         │ │
│ ├ Сложность   │ └─────────────────┘ │
│ └ Transport   │                     │
│               │                     │
│ [Применить]   │                     │
└───────────────┴─────────────────────┘
```
**Проблема:** Все фильтры видны → перегрузка

---

### Desktop — After

```
┌───────────────┬─────────────────────┐
│ PRIMARY       │ КАРТА               │
│ ├ 📍 Радиус   │ ┌─────────────────┐ │
│ ├ 🏛 Категория │ │ Map              │ │
│ ├ 🚗 Транспорт │ │                  │ │
│               │ │ Controls (L):    │ │
│ [+] Больше    │ │ +/- zoom         │ │
│   (2)         │ └─────────────────┘ │
│               │                     │
│ SECONDARY     │ Legend (R-bottom):  │
│ ├ Теги        │ 🟦 Музеи 🟩 Парки   │
│ └ ...         │                     │
└───────────────┴─────────────────────┘
```
**Улучшение:** Progressive disclosure + контролы слева

---

### Mobile — Before

```
┌──────────────────┐
│ MAP              │
│ ┌──────────────┐ │
│ │              │ │
│ │ Controls (R):│ │
│ │ +/- zoom     │ │ ← Перекрыты
│ └──────────────┘ │
├──────────────────┤
│ BOTTOM SHEET     │
│ [Список][Фильтры]│
│ Content...       │
└──────────────────┘
```
**Проблема:** Sheet перекрывает zoom

---

### Mobile — After

```
┌──────────────────┐
│ MAP              │
│ ┌──────────────┐ │
│ │Controls (L): │ │ ← Перенесены влево
│ │+/- zoom      │ │
│ │              │ │
│ └──────────────┘ │
├──────────────────┤
│ ━━ (drag)        │
│ PEEK PREVIEW     │
│ [🖼️ Place1] [2] [3]│
│                  │
│ [Список • 12]    │
│ [Фильтры]        │
└──────────────────┘
```
**Улучшение:** Контролы слева + peek с изображениями

---

## 🔥 Quick Wins (за 1 день)

### 1. Toast для маршрута
```typescript
// В MapScreen.tsx после построения маршрута
import { showToast } from '@/utils/toast';

// После успешного построения:
showToast({
  type: 'success',
  text1: `Маршрут построен`,
  text2: `${routeDistance.toFixed(1)} км • ${Math.round(routeDuration / 60)} мин`,
  position: 'bottom',
});
```

---

### 2. Badge на вкладке "Список"
```typescript
// В SegmentedControl.tsx
<Text style={styles.tabLabel}>
  Список
  {count > 0 && (
    <View style={styles.badge}>
      <Text style={styles.badgeText}>{count}</Text>
    </View>
  )}
</Text>
```

---

### 3. Дружелюбные ошибки
```typescript
// В MapScreen.tsx
const friendlyErrors = {
  'Network request failed': 'Нет соединения. Проверьте интернет',
  'timeout': 'Сервер не отвечает. Попробуйте позже',
  default: 'Что-то пошло не так. Обновите страницу',
};
```

---

## 📊 Метрики (что отслеживать)

### До рефакторинга
- Time to first interaction: **3.5s**
- Bounce rate: **45%**
- Route builds/session: **0.3**

### После P1
- TTFI: **<2s** ✅
- Bounce: **<35%** ✅
- Route builds: **>0.8** ✅

### После P1+P2
- TTFI: **<2s** ✅
- Bounce: **<30%** ✅
- Route builds: **>1.2** ✅

---

## 🛠 Tech Stack

**Текущее:**
- `react-leaflet` — карта
- `@shopify/flash-list` — список
- `react-native-gesture-handler` — Bottom Sheet
- `Animated` API — анимации

**Добавить:**
- `react-native-reanimated` — плавные анимации
- `react-joyride` или кастомный компонент — onboarding

---

## 📁 Файловая структура (изменения)

```
components/MapPage/
├── Map/
│   ├── MapControls.tsx              [изменить] контролы слева
│   ├── MapLayers.tsx                [изменить] тёмная тема
│   └── ClusterLayer.tsx             [изменить] цветовой gradient
├── MapMobileLayout.tsx              [изменить] collision fix
├── MapBottomSheet.tsx               [изменить] reanimated
├── FiltersPanelBody.tsx             [изменить] progressive disclosure
├── SegmentedControl.tsx             [изменить] badge
├── MapPeekPreview.tsx               [изменить] thumbnails
├── TravelListPanel.tsx              [изменить] группировка
├── MapOnboarding.tsx                [новый] onboarding
└── RouteShareButton.tsx             [новый] share
```

---

## 🚦 Roadmap

```
┌─────────────────────────────────────────────────────┐
│ Week 1-2: P1 (Foundation)                           │
│ • Bottom Sheet fix                                  │
│ • Toast notifications                               │
│ • Progressive disclosure                            │
│ • Onboarding                                        │
└─────────────────────────────────────────────────────┘
               ↓
┌─────────────────────────────────────────────────────┐
│ Week 3-6: P2 (Enhancement)                          │
│ • Peek Preview с изображениями                      │
│ • Список — группировка                              │
│ • Dark mode карты                                   │
│ • Геокодер                                          │
│ • Share маршрута                                    │
└─────────────────────────────────────────────────────┘
               ↓
┌─────────────────────────────────────────────────────┐
│ Week 7+: P3 (Polish)                                │
│ • Heatmap mode                                      │
│ • Street View                                       │
│ • Offline mode                                      │
│ • Save маршрута                                     │
└─────────────────────────────────────────────────────┘
```

---

## 💡 Pro Tips

1. **Начните с Quick Wins** — toast + badge → мгновенный эффект
2. **A/B тестируйте** — progressive disclosure vs всё открыто
3. **Используйте SkeletonLoader** — везде вместо ActivityIndicator
4. **Мемоизируйте** — карточки в списке дорогие (useMemo)
5. **Тестируйте на реальных устройствах** — симулятор ≠ реальность

---

## 🎓 Референсы

**Похожие интерфейсы:**
- Google Maps — мобильный UX
- Apple Maps — минимализм
- Komoot — route planning
- Airbnb — карта с фильтрами

**Документация:**
- [Leaflet docs](https://leafletjs.com/)
- [React Native Reanimated](https://docs.swmansion.com/react-native-reanimated/)
- [FlashList](https://shopify.github.io/flash-list/)

---

## 📞 Контакты

**Вопросы по UX:** См. `MAP_PAGE_REFACTORING_SPEC.md` (полное ТЗ)  
**Вопросы по Design System:** См. `DESIGN_SYSTEM_CONSOLIDATION.md`  
**Вопросы по общему UI:** См. `UI_UX_IMPROVEMENT_SPEC.md`

---

**Успехов в рефакторинге! 🚀**

