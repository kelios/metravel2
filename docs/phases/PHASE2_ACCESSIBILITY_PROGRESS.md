## Phase 2: Accessibility (WCAG AAA) - IMPLEMENTATION PROGRESS

**Статус:** 🟢 IN PROGRESS (25% complete)

### ✅ ВЫПОЛНЕНО

#### Utilities & Helpers
- [x] **`utils/a11y.ts`** - 16 утилит для доступности
  - Color contrast checker (WCAG AA/AAA)
  - ARIA role mapping
  - Keyboard event handler
  - Focus management
  - Live region helper
  - Alt text validator
  - Heading hierarchy validator
  - Reduced motion detection
  - Color blind mode checker

#### Custom Hooks
- [x] **`hooks/useKeyboardNavigation.ts`** - управление клавиатурной навигацией
  - Tab navigation с focus trap
  - Arrow key handling
  - Escape key handling
- [x] **`useFocusManager`** - управление фокусом
  - Save/restore focus позиции
  - Focus element by ID
  - Focus first interactive element
- [x] **`useAccessibilityAnnounce`** - объявления для screen readers
- [x] **`useReducedMotion`** - поддержка prefers-reduced-motion
- [x] **`useFocusVisible`** - показ фокуса только для клавиатуры
- [x] **`useScrollAnnounce`** - объявления при скролле

#### Components
- [x] **`SkipToContentLink`** - быстрый переход к основному контенту
- [x] **`AccessibilityAnnouncer`** - ARIA live region для объявлений
- [x] **`AccessibilityAlert`** - специализированный компонент для алертов

#### Tests
- [x] **`__tests__/a11y/a11y.test.ts`** - 28 тестов, все ✅ PASSED
  - Color contrast checks
  - ARIA role validation
  - Alt text validation
  - Keyboard navigation hooks
  - Focus management
  - Accessibility announcements
  - Reduced motion support
  - Design system compliance
  - Typography validation (font sizes >= 12px, основной текст >= 14px)
  - Spacing validation (4px grid system)
  - Animation duration checks
  - Z-index scale validation

### 🔜 TODO

#### ARIA & Semantics (Priority: HIGH)
- [ ] Добавить `role="region"` на основные секции TravelDetailsContainer
- [ ] Добавить `aria-label` на все интерактивные элементы
- [ ] Добавить `aria-expanded` на CollapsibleBlock компоненты
- [ ] Использовать семантические HTML элементы (`<article>`, `<section>`, `<nav>`)
- [ ] Добавить `aria-live` на динамические блоки
- [ ] Добавить `aria-current="page"` на текущий пункт меню
- [ ] Добавить `aria-describedby` для описания элементов

#### Keyboard Navigation (Priority: CRITICAL)
- [ ] Интегрировать `useKeyboardNavigation` в TravelDetailsContainer
- [ ] Добавить `SkipToContentLink` компонент на страницу
- [ ] Тестировать Tab navigation flow
- [ ] Убедиться что focus order логичен
- [ ] Добавить Escape handling для модальных окон
- [ ] Тестировать с assistive technologies (screen readers)

#### Screen Reader Support (Priority: HIGH)
- [ ] Тестировать с NVDA (Windows)
- [ ] Тестировать с JAWS (Windows)
- [ ] Тестировать с VoiceOver (Mac/iOS)
- [ ] Написать/проверить alt text для всех изображений
- [ ] Добавить описания для сложных элементов (карты, графики)
- [ ] Убедиться что динамический контент объявляется

#### Visual Accessibility (Priority: MEDIUM)
- [ ] Проверить контрастность с axe-core инструментом
- [ ] Убедиться что нет текста < 14px
- [ ] Тестировать в режиме high contrast
- [ ] Проверить на color-blind режимах (protanopia, deuteranopia, tritanopia)
- [ ] Убедиться что действия не полагаются только на цвет

#### Dark Mode Support (Priority: FUTURE)
- [ ] Добавить `prefers-color-scheme` detection
- [ ] Создать dark mode цветовую схему в DESIGN_TOKENS
- [ ] Сохранять предпочтение в localStorage
- [ ] Плавный transition при переключении (300ms)

---

## 📋 Implementation Guide

### 1. Использование Color Contrast Utils

```typescript
import { checkContrast, isWCAG_AA, isWCAG_AAA } from '@/utils/a11y';
import { DESIGN_TOKENS } from '@/constants/designSystem';

// Проверка контрастности
const contrast = checkContrast(
  DESIGN_TOKENS.colors.text,
  DESIGN_TOKENS.colors.background
);

// Проверка соответствия стандартам
if (isWCAG_AA(textColor, bgColor)) {
  console.log('✅ WCAG AA compliant');
}

if (isWCAG_AAA(textColor, bgColor)) {
  console.log('✅ WCAG AAA compliant (highest)');
}
```

### 2. Использование Keyboard Navigation

```typescript
import { useKeyboardNavigation, useFocusManager } from '@/hooks/useKeyboardNavigation';

export const MyComponent = () => {
  const { containerRef, onKeyDown } = useKeyboardNavigation({
    onEscape: () => handleClose(),
    onEnter: () => handleSubmit(),
    trapFocus: true, // для модалей
  });

  return (
    <div ref={containerRef} onKeyDown={onKeyDown}>
      {/* content */}
    </div>
  );
};
```

### 3. Использование Focus Manager

```typescript
const { saveFocus, restoreFocus, focusElement } = useFocusManager();

const handleOpenModal = () => {
  saveFocus(); // Сохраняем текущий фокус
  openModal();
};

const handleCloseModal = () => {
  closeModal();
  restoreFocus(); // Восстанавливаем фокус
};
```

### 4. Использование Accessibility Announcer

```typescript
import AccessibilityAnnouncer, { AccessibilityAlert } from '@/components/accessibility/AccessibilityAnnouncer';

export const MyComponent = () => {
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  return (
    <>
      <AccessibilityAnnouncer message={message} priority="polite" />
      <AccessibilityAlert message={error} type="error" />
      
      <button onClick={() => setMessage('Content loaded')}>
        Load
      </button>
    </>
  );
};
```

### 5. Добавление ARIA атрибутов

```typescript
// Семантический раздел
<section
  role="region"
  aria-label="Travel description"
  aria-labelledby="description-heading"
>
  <h2 id="description-heading">Description</h2>
  <p>{description}</p>
</section>

// Expandable элемент
<button
  aria-expanded={isExpanded}
  aria-controls="collapsible-content"
  onClick={() => setIsExpanded(!isExpanded)}
>
  Toggle Content
</button>
<div id="collapsible-content" hidden={!isExpanded}>
  {content}
</div>

// Skip to content link
<SkipToContentLink targetId="main-content" label="Skip to main content" />
<main id="main-content" role="main">
  {/* main content */}
</main>
```

---

## 📊 Test Coverage

```
✅ Color Contrast (4 tests)
✅ ARIA Roles (2 tests)
✅ Alt Text Validation (2 tests)
✅ Keyboard Navigation (2 tests)
✅ Focus Management (1 test)
✅ Accessibility Announce (2 tests)
✅ Reduced Motion (2 tests)
✅ Focus Visible (1 test)
✅ Design System WCAG Compliance (3 tests)
✅ Typography (3 tests)
✅ Spacing (2 tests)
✅ Animations (2 tests)
✅ Z-Index (1 test)
✅ Dark Mode (1 test)

ИТОГО: 28 tests, 28 PASSED ✅
```

---

## 🎯 Success Criteria Phase 2

- [ ] Все интерактивные элементы имеют ARIA роли и labels
- [ ] Tab navigation работает корректно
- [ ] Skip-to-content link видна на Tab
- [ ] Все изображения имеют качественный alt text
- [ ] Нет нарушений WCAG AAA контрастности для основного текста
- [ ] Модальные окна имеют focus trap
- [ ] Screen readers правильно объявляют динамический контент
- [ ] Lighthouse a11y > 95/100
- [ ] axe-core audit = 0 issues

---

## 📞 Next Steps

1. **Интегрировать ARIA** в TravelDetailsContainer (2-3 часа)
2. **Добавить keyboard navigation** (1-2 часа)
3. **Написать alt text** для изображений (1 час)
4. **Провести manual testing** с assistive technologies (2 часа)
5. **Запустить axe-core audit** и исправить issues (1-2 часа)
6. **Запустить Lighthouse a11y test** (30 минут)

**Примерное время:** 8-10 часов

---

**Последнее обновление:** 2025-12-29  
**Версия:** 2.0.0 (Phase 2 In Progress)

