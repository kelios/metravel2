# Документация по тестированию приложения MeTravel

**Версия:** 1.0  
**Дата:** 2025-01-27  
**Приложение:** MeTravel - платформа для путешествий и маршрутов

---

## 1. ОБЩАЯ ИНФОРМАЦИЯ О ПРИЛОЖЕНИИ

### 1.1. Описание приложения
MeTravel - это кроссплатформенное приложение (React Native/Expo) для создания, просмотра и обмена маршрутами путешествий. Приложение поддерживает веб, iOS и Android платформы.

### 1.2. Технологический стек
- **Frontend Framework:** React Native 0.76.7, Expo 52.0.35
- **Routing:** Expo Router 4.0.17
- **State Management:** React Context API, TanStack React Query 5.76.2
- **UI Library:** React Native Paper 5.13.1
- **Maps:** expo-maps, react-native-maps, leaflet
- **Testing:** Jest 29.2.1, React Testing Library 13.3.3
- **Language:** TypeScript 5.7.3

### 1.3. Основные функции приложения

#### 1.3.1. Управление путешествиями
- Просмотр списка путешествий с фильтрацией и поиском
- Детальный просмотр путешествия (галерея, описание, карта, маршрут)
- Создание новых путешествий
- Редактирование и удаление путешествий (для авторов)
- Экспорт путешествий в PDF

#### 1.3.2. Карта и геолокация
- Интерактивная карта с маркерами путешествий
- Фильтрация по радиусу или маршруту
- Поиск путешествий по категориям
- Отображение маршрутов на карте
- Статистика маршрута (расстояние, время)

#### 1.3.3. Аутентификация и пользователи
- Регистрация новых пользователей
- Вход в систему (логин)
- Восстановление пароля
- Установка нового пароля
- Профиль пользователя
- Управление избранным

#### 1.3.4. Контент
- Статьи о путешествиях
- Квесты по городам
- Персонализированные рекомендации
- Еженедельные подборки
- Категории путешествий

#### 1.3.5. Дополнительные функции
- Экспорт в PDF (фотоальбом)
- Поиск и фильтрация
- Сортировка путешествий
- Поделиться путешествием
- Навигация между путешествиями
- Виджет погоды
- Чтение прогресса

---

## 2. АРХИТЕКТУРА ПРИЛОЖЕНИЯ

### 2.1. Структура проекта

```
metravel2/
├── app/                    # Экранные компоненты (Expo Router)
│   ├── (tabs)/            # Табы навигации
│   │   ├── index.tsx      # Главная страница (список путешествий)
│   │   ├── map.tsx        # Карта
│   │   ├── travel/        # Детали путешествия
│   │   ├── articles.tsx   # Статьи
│   │   ├── quests/        # Квесты
│   │   ├── login.tsx      # Вход
│   │   ├── registration.tsx # Регистрация
│   │   └── profile.tsx    # Профиль
│   └── _layout.tsx        # Корневой layout
├── components/            # Переиспользуемые компоненты
│   ├── travel/           # Компоненты путешествий
│   ├── MapPage/          # Компоненты карты
│   ├── listTravel/       # Компоненты списка
│   ├── export/           # Экспорт в PDF
│   └── ...
├── context/              # React Context провайдеры
│   ├── AuthContext.tsx   # Аутентификация
│   └── FavoritesContext.tsx # Избранное
├── hooks/                # Кастомные хуки
├── src/                  # Бизнес-логика
│   ├── api/              # API запросы
│   ├── types/            # TypeScript типы
│   └── utils/            # Утилиты
├── __tests__/            # Тесты
└── utils/                # Общие утилиты
```

### 2.2. Основные компоненты

#### 2.2.1. ListTravel
**Путь:** `components/listTravel/ListTravel.tsx`  
**Описание:** Главный компонент списка путешествий с фильтрацией, поиском, пагинацией и экспортом.

**Основные функции:**
- Отображение списка путешествий
- Поиск по тексту
- Фильтрация по категориям, странам, датам
- Бесконечная прокрутка (infinite scroll)
- Экспорт выбранных путешествий в PDF
- Персонализированные рекомендации
- Еженедельные подборки

#### 2.2.2. MapScreen
**Путь:** `app/(tabs)/map.tsx`  
**Описание:** Экран интерактивной карты с маркерами путешествий.

**Основные функции:**
- Отображение карты с маркерами
- Фильтрация по радиусу или маршруту
- Поиск по адресу
- Панель фильтров
- Панель списка путешествий
- Статистика маршрута

#### 2.2.3. TravelDetails
**Путь:** `app/(tabs)/travels/[param].tsx`  
**Описание:** Детальная страница путешествия.

**Основные функции:**
- Галерея изображений
- Описание путешествия
- Видео
- Интерактивная карта маршрута
- Точки маршрута
- Похожие путешествия
- Навигация между путешествиями
- Поделиться
- Прогресс чтения

#### 2.2.4. AuthContext
**Путь:** `context/AuthContext.tsx`  
**Описание:** Контекст управления аутентификацией.

**Основные функции:**
- Проверка аутентификации
- Вход в систему
- Выход из системы
- Восстановление пароля
- Установка нового пароля
- Хранение токена и данных пользователя

---

## 3. ТЕСТИРОВАНИЕ

### 3.1. Настройка тестовой среды

#### 3.1.1. Зависимости
```json
{
  "jest": "^29.2.1",
  "jest-expo": "~52.0.3",
  "@testing-library/react-native": "^13.3.3",
  "@testing-library/jest-native": "^5.4.3",
  "react-test-renderer": "18.3.1"
}
```

#### 3.1.2. Конфигурация Jest
**Файл:** `package.json`
```json
{
  "jest": {
    "preset": "jest-expo",
    "setupFilesAfterEnv": ["<rootDir>/__tests__/setup.ts"],
    "testMatch": ["**/__tests__/**/*.test.tsx", "**/__tests__/**/*.test.ts"],
    "moduleNameMapper": {
      "^@/(.*)$": "<rootDir>/$1"
    }
  }
}
```

#### 3.1.3. Моки и настройки
**Файл:** `__tests__/setup.ts`

Моки включают:
- `expo-router` - роутинг
- `@react-native-async-storage/async-storage` - локальное хранилище
- `react-native-vector-icons` - иконки
- `@expo/vector-icons` - иконки Expo
- `react-native-paper` - UI библиотека
- `react-native/Libraries/Linking/Linking` - открытие URL
- `react-native` - размеры окна

### 3.2. Структура тестов

```
__tests__/
├── components/          # Тесты компонентов
│   ├── listTravel/     # Тесты списка путешествий
│   ├── MapPage/        # Тесты карты
│   └── ...
├── context/            # Тесты контекстов
├── hooks/              # Тесты хуков
├── routes/             # Тесты роутов
├── services/           # Тесты сервисов
└── utils/              # Тесты утилит
```

### 3.3. Типы тестов

#### 3.3.1. Unit тесты
- Тестирование отдельных компонентов
- Тестирование утилит и функций
- Тестирование хуков
- Тестирование контекстов

#### 3.3.2. Integration тесты
- Тестирование взаимодействия компонентов
- Тестирование API запросов
- Тестирование навигации

#### 3.3.3. E2E тесты (планируется)
- Полные пользовательские сценарии
- Тестирование на реальных устройствах

### 3.4. Покрытие тестами

#### 3.4.1. Протестированные компоненты
- ✅ `ButtonComponent`
- ✅ `CheckboxComponent`
- ✅ `TextInputComponent`
- ✅ `SelectComponent`
- ✅ `NumberInputComponent`
- ✅ `ConfirmDialog`
- ✅ `CustomHeader`
- ✅ `Footer`
- ✅ `FavoriteButton`
- ✅ `Breadcrumbs`
- ✅ `PaginationComponent`
- ✅ `SortSelector`
- ✅ `PersonalizedRecommendations`
- ✅ `WeeklyHighlights`
- ✅ `MapPage` компоненты
- ✅ `ListTravel` (частично)
- ✅ `AuthContext`
- ✅ `FavoritesContext`

#### 3.4.2. Требуют дополнительного тестирования
- ⚠️ `TravelDetails` (детальная страница)
- ⚠️ `MapScreen` (полный экран карты)
- ⚠️ `ArticleEditor`
- ⚠️ `PDF Export` (полное покрытие)
- ⚠️ `Quests` функциональность
- ⚠️ Интеграционные тесты навигации

---

## 4. ЗАПУСК ТЕСТОВ

### 4.1. Команды

```bash
# Запуск всех тестов
npm test

# Запуск тестов в watch режиме
npm test -- --watch

# Запуск тестов с покрытием
npm test -- --coverage

# Запуск конкретного теста
npm test -- ButtonComponent.test.tsx
```

### 4.2. Ожидаемые результаты

Все тесты должны проходить успешно. При наличии падающих тестов:
1. Проверить логи ошибок
2. Убедиться, что все моки настроены правильно
3. Проверить зависимости
4. Обновить тесты при изменении API

---

## 5. BEST PRACTICES

### 5.1. Написание тестов

1. **Именование:** Использовать описательные имена тестов
   ```typescript
   test('should render button with correct text', () => { ... });
   test('should call onPress when button is clicked', () => { ... });
   ```

2. **Структура:** Arrange-Act-Assert (AAA)
   ```typescript
   test('example', () => {
     // Arrange
     const props = { ... };
     
     // Act
     const { getByText } = render(<Component {...props} />);
     
     // Assert
     expect(getByText('Expected')).toBeTruthy();
   });
   ```

3. **Изоляция:** Каждый тест должен быть независимым
4. **Моки:** Использовать моки для внешних зависимостей
5. **Покрытие:** Стремиться к покрытию критичных путей

### 5.2. Тестирование компонентов

```typescript
import { render, fireEvent } from '@testing-library/react-native';
import { Component } from '@/components/Component';

test('should render correctly', () => {
  const { getByText } = render(<Component />);
  expect(getByText('Expected Text')).toBeTruthy();
});

test('should handle user interaction', () => {
  const onPress = jest.fn();
  const { getByTestId } = render(<Component onPress={onPress} />);
  
  fireEvent.press(getByTestId('button'));
  expect(onPress).toHaveBeenCalledTimes(1);
});
```

### 5.3. Тестирование хуков

```typescript
import { renderHook, act } from '@testing-library/react-hooks';
import { useCustomHook } from '@/hooks/useCustomHook';

test('should return correct value', () => {
  const { result } = renderHook(() => useCustomHook());
  expect(result.current.value).toBe(expectedValue);
});
```

### 5.4. Тестирование контекстов

```typescript
import { render } from '@testing-library/react-native';
import { AuthProvider, useAuth } from '@/context/AuthContext';

test('should provide auth context', () => {
  const TestComponent = () => {
    const { isAuthenticated } = useAuth();
    return <Text>{isAuthenticated ? 'Authenticated' : 'Not Authenticated'}</Text>;
  };
  
  const { getByText } = render(
    <AuthProvider>
      <TestComponent />
    </AuthProvider>
  );
  
  expect(getByText('Not Authenticated')).toBeTruthy();
});
```

---

## 6. ИЗВЕСТНЫЕ ПРОБЛЕМЫ И ОГРАНИЧЕНИЯ

### 6.1. Проблемы тестирования

1. **Моки Expo модулей:** Некоторые нативные модули Expo требуют дополнительных моков
2. **Асинхронные операции:** Требуется правильная обработка async/await в тестах
3. **Платформенные различия:** Некоторые тесты могут вести себя по-разному на разных платформах

### 6.2. Ограничения

1. **E2E тесты:** В настоящее время отсутствуют полноценные E2E тесты
2. **Визуальное тестирование:** Нет автоматизированного визуального регрессионного тестирования
3. **Производительность:** Нет автоматизированных тестов производительности

---

## 7. ПЛАН УЛУЧШЕНИЯ ТЕСТИРОВАНИЯ

### 7.1. Краткосрочные цели
- [ ] Увеличить покрытие тестами до 80%
- [ ] Добавить тесты для `TravelDetails`
- [ ] Добавить тесты для `MapScreen`
- [ ] Добавить интеграционные тесты навигации

### 7.2. Долгосрочные цели
- [ ] Настроить E2E тестирование (Detox или Appium)
- [ ] Добавить визуальное регрессионное тестирование
- [ ] Настроить CI/CD с автоматическим запуском тестов
- [ ] Добавить тесты производительности

---

## 8. КОНТАКТЫ И РЕСУРСЫ

### 8.1. Документация
- [Expo Testing](https://docs.expo.dev/guides/testing-with-jest/)
- [React Native Testing Library](https://callstack.github.io/react-native-testing-library/)
- [Jest Documentation](https://jestjs.io/docs/getting-started)

### 8.2. Полезные команды
```bash
# Очистка кэша Jest
npm test -- --clearCache

# Запуск тестов в verbose режиме
npm test -- --verbose

# Запуск тестов с фильтром
npm test -- --testNamePattern="Button"
```

---

**Последнее обновление:** 2025-01-27

