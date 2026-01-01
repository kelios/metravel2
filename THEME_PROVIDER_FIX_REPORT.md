# ✅ Исправление: useTheme must be used within ThemeProvider

**Дата:** 1 января 2026  
**Проблема:** Ошибка `useTheme must be used within ThemeProvider` при запуске приложения

---

## 🐛 Исходная ошибка

```
useTheme must be used within ThemeProvider
Source
  35 |
  36 |   if (!context) {
> 37 |     throw new Error('useTheme must be used within ThemeProvider');
     |           ^
  38 |   }
  39 |
  40 |   return context;
```

---

## 🔍 Причина

В файле `app/_layout.tsx` компонент `RootLayoutNav` вызывал `useThemedColors()` на **строке 130** (через `const colors = useThemedColors()`), НО `ThemeProvider` оборачивал компоненты только внутри `return` statement (строка 299).

```typescript
function RootLayoutNav() {
  const colors = useThemedColors(); // ❌ ВЫЗОВ ДО ThemeProvider!
  const styles = useMemo(() => createStyles(colors), [colors]);
  
  // ... остальной код ...
  
  return (
    <ErrorBoundary>
      <ThemeProvider> {/* ✅ ThemeProvider здесь, но уже слишком поздно */}
        {/* ... */}
      </ThemeProvider>
    </ErrorBoundary>
  );
}
```

**Проблема:** React Hooks выполняются **сверху вниз**, поэтому `useThemedColors()` вызывался **ДО** того, как компонент попадал в контекст `ThemeProvider`.

---

## ✅ Решение

Создан новый компонент `ThemedContent`, который находится **ВНУТРИ** `ThemeProvider` и имеет доступ к контексту темы:

### Структура до исправления:
```typescript
function RootLayoutNav() {
  const colors = useThemedColors(); // ❌ Нет доступа к ThemeProvider
  
  return (
    <ThemeProvider>
      <ThemedPaperProvider>
        {/* контент */}
      </ThemedPaperProvider>
    </ThemeProvider>
  );
}
```

### Структура после исправления:
```typescript
function RootLayoutNav() {
  // Нет вызова useThemedColors здесь
  
  return (
    <ThemeProvider>
      <ThemedContent /> {/* ✅ Новый компонент внутри ThemeProvider */}
    </ThemeProvider>
  );
}

function ThemedContent(props) {
  const colors = useThemedColors(); // ✅ Теперь внутри ThemeProvider!
  const styles = useMemo(() => createStyles(colors), [colors]);
  
  return (
    <ThemedPaperProvider>
      {/* весь контент приложения */}
    </ThemedPaperProvider>
  );
}
```

---

## 🔧 Детали изменений

### 1. **Удалён преждевременный вызов `useThemedColors`**

**До:**
```typescript
function RootLayoutNav() {
  const pathname = usePathname();
  const { width } = useResponsive();
  const colors = useThemedColors(); // ❌ Удалено
  const [clientWidth, setClientWidth] = useState<number | null>(null);
```

**После:**
```typescript
function RootLayoutNav() {
  const pathname = usePathname();
  const { width } = useResponsive();
  // colors удалён отсюда
  const [clientWidth, setClientWidth] = useState<number | null>(null);
```

### 2. **Создан компонент `ThemedContent`**

```typescript
function ThemedContent({
  pathname,
  showMapBackground,
  showFooter,
  isMobile,
  dockHeight,
  setDockHeight,
  isMounted,
}: ThemedContentProps) {
  const colors = useThemedColors(); // ✅ Теперь внутри ThemeProvider
  const styles = useMemo(() => createStyles(colors), [colors]);
  
  const defaultTitle = "MeTravel — путешествия и маршруты";
  const defaultDescription = "Маршруты, места и впечатления от путешественников.";
  const SITE = process.env.EXPO_PUBLIC_SITE_URL || "https://metravel.by";
  const canonical = `${SITE}${pathname || "/"}`;
  const mapBackground = require("../assets/travel/roulette-map-bg.jpg");
  const WEB_FOOTER_RESERVE_HEIGHT = 56;
  
  const BottomGutter = () => {
    if (!showFooter || !isMobile) return null;
    
    if (Platform.OS === 'web') {
      return <View testID="bottom-gutter" style={{ height: WEB_FOOTER_RESERVE_HEIGHT }} />;
    }

    const h = dockHeight;
    if (h <= 0) return null;

    return <View testID="bottom-gutter" style={{ height: h }} />;
  };

  return (
    <ThemedPaperProvider>
      {/* весь контент */}
    </ThemedPaperProvider>
  );
}
```

### 3. **Обновлена структура рендеринга**

**До:**
```typescript
return (
  <ErrorBoundary>
    <ThemeProvider>
      <ThemedPaperProvider>
        {/* контент напрямую */}
      </ThemedPaperProvider>
    </ThemeProvider>
  </ErrorBoundary>
);
```

**После:**
```typescript
return (
  <ErrorBoundary>
    <ThemeProvider>
      <ThemedContent
        pathname={pathname}
        showMapBackground={showMapBackground}
        showFooter={showFooter}
        isMobile={isMobile}
        dockHeight={dockHeight}
        setDockHeight={setDockHeight}
        isMounted={isMounted}
      />
    </ThemeProvider>
  </ErrorBoundary>
);
```

### 4. **Удалены дублирующиеся определения**

Следующие переменные были перенесены из `RootLayoutNav` в `ThemedContent`:
- ❌ `const SITE = ...` (удалено из RootLayoutNav)
- ❌ `const canonical = ...` (удалено из RootLayoutNav)
- ❌ `const defaultTitle = ...` (удалено из RootLayoutNav)
- ❌ `const defaultDescription = ...` (удалено из RootLayoutNav)
- ❌ `const mapBackground = ...` (удалено из RootLayoutNav)
- ❌ `const WEB_FOOTER_RESERVE_HEIGHT = ...` (удалено из RootLayoutNav)
- ❌ `const BottomGutter = ...` (удалено из RootLayoutNav)

Все они теперь определены **ВНУТРИ** `ThemedContent`, где есть доступ к `useThemedColors`.

### 5. **Исправлен экран загрузки для native**

**До:**
```typescript
if (!fontsLoaded && !isWeb) {
  return (
    <View style={styles.fontLoader}> {/* ❌ styles не определён */}
      <ActivityIndicator size="small" color={colors.primary} /> {/* ❌ colors не определён */}
    </View>
  );
}
```

**После:**
```typescript
if (!fontsLoaded && !isWeb) {
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#fdfcfb' }}>
      <ActivityIndicator size="small" color="#7a9d8f" />
    </View>
  );
}
```

---

## 📊 Иерархия компонентов

### До исправления:
```
RootLayoutNav (вызывает useThemedColors) ❌
└── return
    └── ThemeProvider
        └── ThemedPaperProvider
            └── контент
```

### После исправления:
```
RootLayoutNav (не вызывает useThemedColors) ✅
└── return
    └── ThemeProvider
        └── ThemedContent (вызывает useThemedColors) ✅
            └── ThemedPaperProvider
                └── контент
```

---

## ✅ Результаты

### Тестирование:
- ✅ **Линтер:** 0 ошибок, 0 предупреждений
- ✅ **TypeScript:** Компиляция успешна
- ✅ **Приложение:** Запускается без ошибок
- ✅ **Темы:** Светлая и тёмная темы работают корректно

### Проверка:
```bash
$ npm run lint
✓ Линтер прошёл успешно
```

---

## 🎯 Ключевые моменты

### 1. **Порядок выполнения React Hooks**
React Hooks выполняются **сверху вниз** в функциональном компоненте. Это означает, что:
```typescript
function Component() {
  const value = useContext(SomeContext); // Выполняется ПЕРВЫМ
  
  return (
    <SomeContext.Provider value={...}> {/* Слишком поздно! */}
      ...
    </SomeContext.Provider>
  );
}
```

### 2. **Правильная структура для Context**
Компонент, использующий Context, должен быть **ВНУТРИ** Provider:
```typescript
function Wrapper() {
  return (
    <Provider>
      <ComponentUsingContext /> {/* ✅ Правильно */}
    </Provider>
  );
}

function ComponentUsingContext() {
  const value = useContext(SomeContext); // ✅ Имеет доступ к Provider
}
```

### 3. **Разделение ответственности**
- `RootLayoutNav` - управляет **общей логикой** (fonts, routes, state)
- `ThemedContent` - управляет **темизированным контентом** (colors, styles, themed components)

---

## 📝 Рекомендации

### Для будущих изменений:

1. **Всегда проверяйте иерархию Provider'ов**
   ```typescript
   // ❌ Неправильно
   const value = useContext(MyContext);
   return <MyContext.Provider>...</MyContext.Provider>
   
   // ✅ Правильно
   return (
     <MyContext.Provider>
       <ComponentThatUsesContext />
     </MyContext.Provider>
   );
   ```

2. **Создавайте отдельные компоненты для themed контента**
   ```typescript
   function Layout() {
     return (
       <ThemeProvider>
         <ThemedComponent /> {/* Отдельный компонент */}
       </ThemeProvider>
     );
   }
   
   function ThemedComponent() {
     const colors = useThemedColors(); // ✅ Безопасно
     // ...
   }
   ```

3. **Избегайте вызовов hooks до Provider'ов**
   - Hooks должны вызываться только в компонентах, которые уже находятся внутри соответствующих Provider'ов
   - Если нужен доступ к context выше по дереву - создайте промежуточный компонент

---

## 🎉 Заключение

Проблема **полностью решена** путём реструктуризации компонентов:

✅ **`useThemedColors()`** теперь вызывается внутри `ThemeProvider`  
✅ **Создан `ThemedContent`** - отдельный компонент для themed контента  
✅ **Удалены дублирующиеся определения**  
✅ **Линтер проходит без ошибок**  
✅ **Приложение работает корректно**  

---

**Статус:** ✅ Проблема решена  
**Дата завершения:** 1 января 2026  
**Автор:** AI Assistant

