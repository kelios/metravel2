# План улучшений PDF Constructor

## Критичные улучшения (высокий приоритет)

### 1. Ограничение перемещения блоков границами страницы

**Проблема:** Блоки могут быть перетащены за пределы страницы.

**Решение:**
```typescript
// В DraggableBlock.tsx
const handleMouseMove = (e: MouseEvent) => {
  const newX = (e.clientX - dragStart.x) / scale;
  const newY = (e.clientY - dragStart.y) / scale;
  
  // Ограничиваем границами страницы
  const minX = 0;
  const minY = 0;
  const maxX = displayWidth - w;
  const maxY = displayHeight - h;
  
  const clampedX = Math.max(minX, Math.min(maxX, newX));
  const clampedY = Math.max(minY, Math.min(maxY, newY));
  
  setDragOffset({
    x: clampedX - x,
    y: clampedY - y,
  });
};
```

### 2. Сохранение пропорций при изменении размера

**Проблема:** Нет сохранения пропорций при зажатом Shift.

**Решение:**
```typescript
// В ResizeHandles.tsx
const handleMouseMove = (e: MouseEvent) => {
  const deltaX = (e.clientX - startPos.x) / scale;
  const deltaY = (e.clientY - startPos.y) / scale;
  
  let newWidth = startSize.width;
  let newHeight = startSize.height;
  
  if (e.shiftKey) {
    // Сохраняем пропорции
    const aspectRatio = startSize.width / startSize.height;
    if (Math.abs(deltaX) > Math.abs(deltaY)) {
      newWidth = startSize.width + deltaX;
      newHeight = newWidth / aspectRatio;
    } else {
      newHeight = startSize.height + deltaY;
      newWidth = newHeight * aspectRatio;
    }
  } else {
    // Обычное изменение размера
    // ...
  }
  
  onResize(newWidth, newHeight, resizeHandle);
};
```

### 3. Улучшение области клика для редактирования

**Проблема:** Двойной клик не всегда активирует редактирование.

**Решение:**
```typescript
// В EditableTextBlock.tsx
<div
  onDoubleClick={(e) => {
    e.stopPropagation();
    onStartEdit();
  }}
  style={{
    width: '100%',
    height: '100%',
    cursor: 'text',
    padding: '4px', // Увеличиваем область клика
    minHeight: '20px', // Минимальная высота для клика
  }}
>
```

### 4. Визуальные подсказки

**Решение:**
```typescript
// Добавить Tooltip компонент
interface TooltipProps {
  text: string;
  children: React.ReactNode;
}

function Tooltip({ text, children }: TooltipProps) {
  const [show, setShow] = useState(false);
  
  return (
    <div
      onMouseEnter={() => setShow(true)}
      onMouseLeave={() => setShow(false)}
      style={{ position: 'relative' }}
    >
      {children}
      {show && (
        <div style={{
          position: 'absolute',
          bottom: '100%',
          left: '50%',
          transform: 'translateX(-50%)',
          backgroundColor: '#333',
          color: '#fff',
          padding: '4px 8px',
          borderRadius: 4,
          fontSize: 12,
          whiteSpace: 'nowrap',
          zIndex: 1000,
        }}>
          {text}
        </div>
      )}
    </div>
  );
}
```

---

## Средние улучшения

### 5. Автоматическое масштабирование при изменении формата

**Решение:**
```typescript
// В PdfDocumentBuilder.ts
updateDocumentFormat(format: PageFormat, orientation: PageOrientation, scaleBlocks: boolean = false): void {
  const oldFormat = PAGE_FORMATS[this.document.format];
  const newFormat = PAGE_FORMATS[format];
  
  const scaleX = newFormat.width / oldFormat.width;
  const scaleY = newFormat.height / oldFormat.height;
  
  this.document.pages.forEach((page) => {
    page.format = format;
    page.orientation = orientation;
    
    if (scaleBlocks) {
      page.blocks.forEach((block) => {
        block.position.x *= scaleX;
        block.position.y *= scaleY;
        block.position.width *= scaleX;
        block.position.height *= scaleY;
      });
    }
  });
}
```

### 6. Множественный выбор блоков

**Решение:**
```typescript
// В PdfConstructor.tsx
const [selectedBlocks, setSelectedBlocks] = useState<Set<string>>(new Set());

const handleBlockClick = (e: React.MouseEvent, blockId: string) => {
  if (e.ctrlKey || e.metaKey) {
    // Добавляем к выбору
    setSelectedBlocks(prev => new Set([...prev, blockId]));
  } else if (e.shiftKey && selectedBlocks.size > 0) {
    // Выбираем диапазон
    // ...
  } else {
    // Одиночный выбор
    setSelectedBlocks(new Set([blockId]));
  }
};
```

### 7. Сохранение истории в localStorage

**Решение:**
```typescript
// В HistoryManager.ts
saveToLocalStorage(documentId: string): void {
  try {
    const data = {
      history: this.history,
      currentIndex: this.currentIndex,
    };
    localStorage.setItem(`pdf-history-${documentId}`, JSON.stringify(data));
  } catch (error) {
    console.warn('Failed to save history to localStorage', error);
  }
}

loadFromLocalStorage(documentId: string): boolean {
  try {
    const data = localStorage.getItem(`pdf-history-${documentId}`);
    if (data) {
      const parsed = JSON.parse(data);
      this.history = parsed.history;
      this.currentIndex = parsed.currentIndex;
      return true;
    }
  } catch (error) {
    console.warn('Failed to load history from localStorage', error);
  }
  return false;
}
```

---

## Низкий приоритет

### 8. Экспорт/импорт макета

**Решение:**
```typescript
// В PdfDocumentBuilder.ts
exportToJSON(): string {
  return JSON.stringify(this.document, null, 2);
}

importFromJSON(json: string): boolean {
  try {
    const doc = JSON.parse(json);
    this.loadDocument(doc);
    return true;
  } catch (error) {
    console.error('Failed to import document', error);
    return false;
  }
}
```

### 9. Шаблоны страниц

**Решение:**
```typescript
// Создать templates/
interface PageTemplate {
  id: string;
  name: string;
  thumbnail: string;
  blocks: Omit<PdfBlock, 'id'>[];
}

const templates: PageTemplate[] = [
  {
    id: 'cover',
    name: 'Обложка',
    thumbnail: '/templates/cover.png',
    blocks: [
      { type: 'heading-h1', position: {...}, styles: {...}, content: 'Заголовок' },
      // ...
    ],
  },
];
```

---

## Метрики для отслеживания

1. **Время отклика UI** - должно быть < 100ms
2. **Время экспорта** - должно быть < 10 сек для 10 страниц
3. **Покрытие тестами** - должно быть > 80%
4. **Размер бандла** - должен быть < 500KB (gzipped)

---

## План внедрения

### Неделя 1:
- Ограничение перемещения блоков
- Сохранение пропорций
- Улучшение области клика

### Неделя 2:
- Визуальные подсказки
- Автоматическое масштабирование
- Сохранение истории

### Неделя 3:
- Множественный выбор
- Экспорт/импорт макета
- Тестирование и оптимизация

