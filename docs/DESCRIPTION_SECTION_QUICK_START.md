# 🚀 DescriptionSection - Quick Start

## Быстрый старт за 60 секунд

### 1️⃣ Импорт (5 сек)
```tsx
import { DescriptionSection } from '@/components/travel/details/redesign/DescriptionSection.redesign';
```

### 2️⃣ Использование (10 сек)
```tsx
<DescriptionSection
  title={travel.name}
  htmlContent={travel.description}
  numberDays={travel.number_days}
  countryName={travel.countryName}
  monthName={travel.monthName}
/>
```

### 3️⃣ С советами (15 сек)
```tsx
const tips = decisionTips.map(tip => ({
  text: tip.text,
  level: tip.level
}));

<DescriptionSection
  {...props}
  decisionTips={tips}
/>
```

### 4️⃣ С кнопкой "Назад" (30 сек)
```tsx
const handleBackToTop = () => {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
};

<DescriptionSection
  {...props}
  onBackToTop={handleBackToTop}
/>
```

---

## 🎯 Props (самое важное)

| Prop | Пример | Обязательно? |
|------|--------|--------------|
| `title` | `"Минск"` | ✅ Да |
| `htmlContent` | `"<p>...</p>"` | ✅ Да |
| `numberDays` | `5` | ❌ Нет |
| `countryName` | `"Беларусь"` | ❌ Нет |
| `monthName` | `"Июнь"` | ❌ Нет |
| `decisionTips` | `[{text,level}]` | ❌ Нет |
| `onBackToTop` | `() => void` | ❌ Нет |

---

## 💡 Примеры

### Минимальный
```tsx
<DescriptionSection
  title="Путешествие"
  htmlContent="<p>Описание</p>"
/>
```

### Полный
```tsx
<DescriptionSection
  title="Минск - Столица Беларуси"
  htmlContent="<p>Подробное описание маршрута...</p>"
  numberDays={5}
  countryName="Беларусь"
  monthName="Июнь"
  decisionTips={[
    { text: 'Возьмите удобную обувь', level: 0 },
    { text: 'Рекомендуем кроссовки', level: 1 },
    { text: 'Забронируйте отель заранее', level: 0 }
  ]}
  onBackToTop={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
/>
```

---

## 🎨 Темная тема

Работает автоматически через `useThemedColors()`:

```tsx
// Компонент автоматически адаптируется к теме
// Не нужно ничего дополнительно настраивать!
```

---

## ✅ Что дальше?

1. Замените старую секцию описания на новую
2. Проверьте в светлой и темной теме
3. Протестируйте на мобильных устройствах
4. Запустите тесты: `npm test -- DescriptionSection.redesign`

---

## 📚 Документация

Полная документация: `docs/DESCRIPTION_SECTION_REDESIGN.md`

---

**Готово!** 🎉

