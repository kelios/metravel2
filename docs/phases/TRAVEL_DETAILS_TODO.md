# TravelDetailsContainer — короткий чеклист актуальных задач

Сосредоточено только на том, что осталось сделать.

## 1) Производительность (Phase 3, в работе)
- [x] Снять baseline: `npm run build`, `npm run lighthouse`, `npm run analyze:bundle` (lighthouse через `LIGHTHOUSE_PACKAGE=lighthouse@11.7.1` для Node 19).
- [x] Dynamic imports для тяжёлых секций/иконок (TravelDetailsDeferred/TravelDetailsHero).
- [x] Tree shaking + удалить неиспользуемые зависимости (убраны `lint`, `format`, `pretty-format`).
- [x] Оптимизация изображений: WebP/AVIF + fallback, lazy-loading секций, blur-up для TravelDetails.
- [x] Уменьшить перерендеры TravelDetailsContainer: мемоизация props/handlers, вынос тяжёлых расчётов в хуки.
- [x] Веб-виталии: таргеты LCP < 2.5s, CLS < 0.1, FID/INP < 100ms (добавлен INP трекинг).

## 2) Рефакторинг TravelDetails
- [x] Разбить TravelDetailsContainer на подкомпоненты: hero, content, map, related, engagement (layout остаётся в контейнере).
- [x] Вынести логику в хуки: useTravelDetailsData, useTravelDetailsLayout, useTravelDetailsNavigation/Menu, useTravelDetailsPerformance.
- [x] Привести стили к единой spacing системе (4px grid) и убрать дубли.

## 3) Доступность (добить Phase 2)
- [ ] Финальные проверки screen reader: NVDA/JAWS/VoiceOver; логичный порядок фокуса, Escape для модалок (manual).
- [x] Проверить/добавить aria-label/aria-expanded/role="region" на ключевые секции.
- [x] Контраст и размеры шрифтов ≥14px, пройти axe-core (добавлен jest-axe, подняты шрифты).

## 4) Тесты
- [x] Расширить unit-тесты утилит/хуков (coverage 80%+).
- [x] Интеграционные тесты TravelDetails: навигация между секциями, загрузка изображений, scroll, меню.
- [x] Проверить мокирование браузерных API (performance, IntersectionObserver) в jest.

## 5) UX/Тема (низкий приоритет)
- [x] Минимальный темный режим (prefers-color-scheme, сохранение выбора).
- [x] Управление темой перенесено в настройки профиля, дефолт — светлая.
- [x] Подправить типографику под 16px тело / 22px mobile h, согласованные line-height.

#### E2E Tests (Playwright)
- [x] Загрузка страницы с данными
- [x] Навигация по секциям
- [x] Sharing functionality
- [x] Deep linking (direct link to section)

#### Accessibility Tests (axe-core)
- [x] Lighthouse a11y > 95/100 (100/100)
- [x] axe-core issues = 0
- [ ] WCAG AAA compliant

#### Performance Tests
- [ ] LCP < 2.5s (local lighthouse: ~24.9s)
- [ ] FID < 100ms (local lighthouse: ~567ms)
- [x] CLS < 0.1 (local lighthouse: ~0.027)
- [ ] Bundle size < 100KB (entry bundle ~4.6MB)

---

## 📋 Detailed Implementation Guide

### 1. Запустить Security Tests
```bash
npm run test:run -- TravelDetailsContainer.security.test --no-coverage
```

### 2. Реализовать Дизайн Улучшения
```javascript
// В styles можно использовать новые функции:
import { getResponsiveSpacing, getAccessibleColor } from '@/utils/travelDetailsUIUX';

const styles = StyleSheet.create({
  container: {
    padding: getResponsiveSpacing(screenWidth),
    backgroundColor: getAccessibleColor(isLightMode).background,
  }
});
```

### 3. Добавить Accessibility
```javascript
// Пример ARIA labels:
<View
  role="region"
  aria-label="Travel description"
  aria-expanded={isExpanded}
>
  {children}
</View>
```

### 4. Мониторить Performance
```javascript
// Добавить Web Vitals tracking:
import { onLCP, onFID, onCLS } from 'web-vitals';

onLCP(console.log);  // LCP
onFID(console.log);  // FID
onCLS(console.log);  // CLS
```

---

## 🔗 Related Files & Resources

### Новые файлы (созданы)
- `/utils/travelDetailsSecure.ts` - Security utilities
- `/utils/travelDetailsUIUX.ts` - UI/UX utilities
- `/hooks/useTravelDetailsUtils.ts` - Custom hooks
- `/__tests__/components/travel/TravelDetailsContainer.security.test.tsx` - Security tests
- `/hooks/useTravelDetailsData.ts` - Data hook wrapper (refactor)
- `/hooks/useTravelDetailsLayout.ts` - Layout calculations (refactor)
- `/hooks/useTravelDetailsNavigation.ts` - Navigation + anchors (refactor)
- `/hooks/useTravelDetailsPerformance.ts` - LCP/defer/perf wiring (refactor)
- `/hooks/useTravelDetailsMenu.ts` - Menu wiring (refactor)
- `/hooks/useTravelDetailsScrollState.ts` - Scroll state + metrics (refactor)
- `/components/travel/details/TravelDetailsHero.tsx` - Hero + LCP logic (refactor)
- `/components/travel/details/TravelDetailsDeferred.tsx` - Deferred sections (refactor)
- `/components/travel/details/TravelDetailsLazy.tsx` - Shared lazy loader (refactor)
- `/components/travel/details/TravelDetailsIcons.tsx` - Lazy icons (refactor)

### Изменённые файлы
- `/components/travel/details/TravelDetailsContainer.tsx` - Main component (refactored)
- `/components/travel/details/TravelDetailsSections.tsx` - Re-export layer after split

### Документация
- `/ANALYSIS_TRAVEL_DETAILS.md` - Initial analysis
- `/TRAVEL_DETAILS_IMPROVEMENTS.md` - Detailed improvements report
- `/TRAVEL_DETAILS_TODO.md` - This file (checklist & recommendations)

---

## 📊 Timeline Estimate

| Phase | Tasks | Duration | Status |
|-------|-------|----------|--------|
| 1 | Security & Types | ✅ 2 дня | DONE |
| 2 | Design & A11y | ⏳ 3 дня | TODO |
| 3 | Performance | ⏳ 2 дня | TODO |
| 4 | Refactoring | ⏳ 4 дня | TODO |
| 5 | Testing | ⏳ 3 дня | TODO |

**Всего:** ~14 дней (2 недели)

---

## 🎯 Success Criteria

### Security ✅
- [x] Нет XSS уязвимостей
- [x] Нет injection attacks
- [x] Все external URLs валидированы
- [x] Код прошёл security review

### Performance ✅
- [x] Нет memory leaks
- [x] Все listeners очищаются
- [x] Нет redundant renders
- [ ] LCP < 2.5s (в процессе)

### Accessibility 🔜
- [ ] WCAG AAA compliant
- [ ] Screen reader compatible
- [ ] Keyboard navigable
- [ ] Color blind friendly

### Quality 🔜
- [ ] 80%+ test coverage
- [ ] 0 lint errors/warnings
- [ ] Все функции документированы
- [ ] Code review passed

---

## 📞 Support & Questions

При возникновении вопросов:

1. **Security**: проверить `utils/travelDetailsSecure.ts`
2. **Hooks**: проверить `hooks/useTravelDetailsUtils.ts`
3. **UI/UX**: проверить `utils/travelDetailsUIUX.ts`
4. **Tests**: запустить `npm run test:run -- TravelDetailsContainer.security.test`

**Контакт:** Обновить при разработке

---

**Последнее обновление:** 2025-01-01  
**Статус:** 🟢 PHASE 1 COMPLETE, 🟡 PHASE 2 PLANNED  
**Версия:** 1.1.0
