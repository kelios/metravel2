# Travel Details Page Refactoring

> Документ создан: 2026-03-15
> Статус: В процессе

## Цель

Рефакторинг страницы путешествий согласно best practices 2026 года:
- Декомпозиция монолитного контейнера
- Упрощение state-машины производительности
- Вынос тяжёлой логики в отдельные хуки
- Улучшение maintainability

---

## Текущее состояние

| Метрика | До рефакторинга |
|---------|-----------------|
| `TravelDetailsContainer.tsx` | 718 строк |
| `TravelDetailsMapSection.tsx` | 609 строк |
| `useEffect` в контейнере | ~15 |
| Performance boolean flags | 4 |

---

## План рефакторинга

### Этап 1: Декомпозиция TravelDetailsContainer

- [ ] **1.1** Вынести trace-логику в `useTravelDetailsTrace` хук
- [ ] **1.2** Вынести SEO-логику в отдельный компонент `TravelDetailsSEO`
- [ ] **1.3** Упростить skeleton state management
- [ ] **1.4** Вынести error states в `TravelDetailsErrorStates`

### Этап 2: Упрощение Performance State

- [ ] **2.1** Заменить 4 boolean флага на единую state machine
- [ ] **2.2** Упростить условия для deferred content

### Этап 3: Рефакторинг TravelDetailsMapSection

- [ ] **3.1** Вынести route file parsing в `useRouteFilePreviews` хук
- [ ] **3.2** Вынести reverse geocoding в `useKeyPointLabels` хук
- [ ] **3.3** Упростить компонент до ~300 строк

### Этап 4: Финальная оптимизация

- [ ] **4.1** Проверить bundle size impact
- [ ] **4.2** Запустить Lighthouse на production build
- [ ] **4.3** Обновить тесты

---

## Прогресс

### ✅ Выполнено

- [x] **1.1** Вынести trace-логику в `useTravelDetailsTrace` хук
  - Создан `hooks/useTravelDetailsTrace.ts` (155 строк)
  - Удалено ~120 строк из `TravelDetailsContainer.tsx`
  - Lint: ✅ | Tests: ✅ (27 suites, 203 tests)

### 🔄 В процессе

_Этап 1.2: Вынос SEO-логики_

### ⏳ Ожидает

_Этапы 1.2 - 4.3_

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
