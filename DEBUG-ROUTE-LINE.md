# Инструкция для отладки линии маршрута

## Что делать в DevTools:

1. **Откройте DevTools (F12) → Elements**

2. **Найдите path элемент:**
   - Нажмите Ctrl+F (поиск в Elements)
   - Введите: `metravel-route-line`
   - Или найдите: `path[stroke="#FF0000"]`

3. **Проверьте стили:**
   - Кликните правой кнопкой на path → Inspect
   - Во вкладке "Styles" посмотрите:
     - `stroke` - должно быть `#FF0000` или `rgb(255, 0, 0)`
     - `stroke-width` - должно быть `10px`
     - `opacity` - должно быть `1`
     - `display` - должно быть `inline`
     - `visibility` - должно быть `visible`

4. **Проверьте clip-path:**
   - В Computed вкладке найдите `clip-path`
   - Если есть clip-path - это может обрезать линию

5. **Проверьте родительский SVG:**
   - Найдите родительский `<svg>` элемент
   - Проверьте его `width`, `height`, `viewBox`
   - Проверьте `overflow` - должно быть `visible`

6. **Временное исправление в консоли:**
   ```javascript
   // Выполните в консоли браузера:
   const paths = document.querySelectorAll('path[stroke="#FF0000"]');
   console.log('Found paths:', paths.length);
   paths.forEach(path => {
     path.style.stroke = '#FF0000';
     path.style.strokeWidth = '10px';
     path.style.opacity = '1';
     path.style.zIndex = '9999';
     console.log('Path updated:', path);
   });
   ```

## Что прислать мне:

1. Скриншот вкладки "Styles" для path элемента
2. Скриншот вкладки "Computed" для path элемента
3. Результат выполнения JavaScript кода из консоли
4. Скриншот карты после выполнения кода - появилась ли красная линия?
