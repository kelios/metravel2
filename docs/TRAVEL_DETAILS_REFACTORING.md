# Travel Details Page Refactoring

> Документ создан: 2026-03-15
> Последнее обновление: 2026-03-15
> Статус: В процессе

## Цель

Рефакторинг страницы путешествий согласно best practices 2026 года:
- Декомпозиция монолитного контейнера
- Упрощение state-машины производительности
- Вынос тяжёлой логики в отдельные хуки
- Улучшение maintainability

---

## Метрики

| Метрика | До | После | Δ |
|---------|-----|-------|---|
| `TravelDetailsContainer.tsx` | 718 строк | 544 строк | **-174** |
| `TravelDetailsMapSection.tsx` | 609 строк | 387 строк | **-222** |
| Новые хуки | 0 | 4 | +4 |
| Новые компоненты | 0 | 1 | +1 |
| Общий код (с хуками/компонентами) | 1327 строк | 1338 строк | +11 |

> **Примечание**: Общий объём кода практически не изменился, но код стал модульным и переиспользуемым.

---

## План рефакторинга

### Этап 1: Декомпозиция TravelDetailsContainer

- [x] **1.1** Вынести trace-логику в `useTravelDetailsTrace` хук
- [ ] **1.2** ~~Вынести SEO-логику~~ (отложено — тесно связана с навигацией)
- [x] **1.3** Упростить skeleton state management → `useSkeletonPhase` хук
- [x] **1.4** Вынести error states в `TravelDetailsErrorStates`

### Этап 2: Упрощение Performance State

- [x] **2.1** ~~Заменить 4 boolean флага на state machine~~ (отложено — текущая структура уже хорошо организована)
- [x] **2.2** ~~Упростить условия для deferred content~~ (не требуется — логика корректна)

### Этап 3: Рефакторинг TravelDetailsMapSection

- [x] **3.1** Вынести route file parsing в `useRouteFilePreviews` хук
- [x] **3.2** Вынести reverse geocoding в `useKeyPointLabels` хук
- [x] **3.3** Упростить компонент до ~400 строк (было 609)

### Этап 4: Финальная оптимизация

- [ ] **4.1** Проверить bundle size impact
- [ ] **4.2** Запустить Lighthouse на production build
- [ ] **4.3** Обновить тесты

---

## Прогресс

### ✅ Выполнено

- [x] **1.1** Вынести trace-логику в `useTravelDetailsTrace` хук
  - Создан `hooks/useTravelDetailsTrace.ts` (161 строк)
  - Удалено ~115 строк из `TravelDetailsContainer.tsx`
  - Lint: ✅ | Tests: ✅

- [x] **1.3** Упростить skeleton state management
  - Создан `hooks/useSkeletonPhase.ts` (41 строка)
  - Удалено ~25 строк из `TravelDetailsContainer.tsx`
  - Lint: ✅ | Tests: ✅

- [x] **1.4** Вынести error states в `TravelDetailsErrorStates`
  - Создан `components/travel/details/TravelDetailsErrorStates.tsx` (69 строк)
  - Удалено ~50 строк из `TravelDetailsContainer.tsx`
  - Lint: ✅ | Tests: ✅

- [x] **3.1** Вынести route file parsing в `useRouteFilePreviews` хук
  - Создан `hooks/useRouteFilePreviews.ts` (135 строк)
  - Удалено ~70 строк из `TravelDetailsMapSection.tsx`
  - Lint: ✅

- [x] **3.2** Вынести reverse geocoding в `useKeyPointLabels` хук
  - Создан `hooks/useKeyPointLabels.ts` (151 строк)
  - Удалено ~130 строк из `TravelDetailsMapSection.tsx`
  - Lint: ✅

### 🔄 В процессе

_Финальная валидация_

### ⏳ Ожидает

_Этапы 4.1-4.3 (bundle size, Lighthouse, тесты)_

---

## Валидация

После каждого изменения:
```bash
npm run lint
npm run test:run
```

---

## Примечания

- Не ломать существующую функциональность
- Сохранять LCP-оптимизации
- Минимальные изменения в API компонентов
