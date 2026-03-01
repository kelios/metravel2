# Google OAuth Setup Guide

## Обзор

В приложении MeTravel реализована авторизация через Google OAuth. Пользователи могут войти в систему используя свой Google аккаунт.

## Архитектура

### Frontend компоненты

1. **`components/auth/GoogleSignInButton.tsx`** - UI компонент кнопки "Войти через Google"
   - Загружает Google Sign-In SDK
   - Инициализирует Google OAuth клиент
   - Обрабатывает callback с credential токеном
   - Только для web платформы

2. **`api/auth.ts`** - API функция `googleAuthApi(credential: string)`
   - Отправляет credential на бэкенд
   - Получает токен авторизации и данные пользователя
   - Обрабатывает ошибки

3. **`stores/authStore.ts`** - Zustand store с методом `loginWithGoogle(credential: string)`
   - Вызывает `googleAuthApi`
   - Сохраняет токен в secure storage
   - Загружает профиль пользователя
   - Обновляет состояние аутентификации

4. **`app/(tabs)/login.tsx`** - Страница входа
   - Интегрирует GoogleSignInButton
   - Обрабатывает успешную авторизацию
   - Выполняет редирект после входа

### Backend endpoint

```
POST /api/user/google-login/
Body: { "id_token": "google_jwt_token" }
Response: {
  "token": "user_auth_token",
  "refresh": "refresh_token",
  "name": "User Name",
  "email": "user@example.com",
  "id": 123,
  "is_superuser": false
}
```

## Настройка

### 1. Google Cloud Console

1. Перейдите на [Google Cloud Console](https://console.cloud.google.com)
2. Создайте новый проект или выберите существующий
3. Включите Google Sign-In API
4. Создайте OAuth 2.0 Client ID:
   - Тип приложения: Web application
   - Authorized JavaScript origins: `https://metravel.by`, `http://localhost:3000`
   - Authorized redirect URIs: не требуется для Google Sign-In
5. Скопируйте Client ID

### 2. Environment Variables

Добавьте в `.env.dev` и `.env.production`:

```bash
EXPO_PUBLIC_GOOGLE_CLIENT_ID=your_client_id_here.apps.googleusercontent.com
```

### 3. Backend Configuration

Убедитесь, что бэкенд настроен для обработки Google OAuth:
- Endpoint `/api/user/google-login/` принимает `id_token`
- Валидирует Google JWT токен
- Создает или находит пользователя
- Возвращает auth token

## Использование

### Для пользователей

1. Откройте страницу `/login`
2. Нажмите кнопку "Войти через Google"
3. Выберите Google аккаунт в всплывающем окне
4. Автоматический вход в систему

### Для разработчиков

```typescript
import { useAuth } from '@/context/AuthContext';

function MyComponent() {
  const { loginWithGoogle } = useAuth();
  
  const handleGoogleAuth = async (credential: string) => {
    const success = await loginWithGoogle(credential);
    if (success) {
      // Пользователь авторизован
    }
  };
}
```

## Безопасность

- Client ID публичный и может быть в коде
- Credential токен валидируется на бэкенде
- Токены хранятся в secure storage
- HTTPS обязателен для production

## Troubleshooting

### Кнопка не появляется
- Проверьте `EXPO_PUBLIC_GOOGLE_CLIENT_ID` в env файле
- Убедитесь что Google SDK загружен (проверьте console)
- Компонент работает только на web платформе

### Ошибка "Не удалось загрузить Google Sign-In"
- Проверьте интернет соединение
- Убедитесь что домен добавлен в Authorized JavaScript origins

### Ошибка авторизации на бэкенде
- Проверьте что endpoint `/api/user/google-login/` доступен
- Убедитесь что бэкенд правильно валидирует Google `id_token`
- Проверьте логи бэкенда

## Тестирование

```bash
# Lint проверка
npm run lint

# Запуск тестов
npm run test:run
```

## Дополнительная информация

- [Google Sign-In для веб](https://developers.google.com/identity/gsi/web)
- [OAuth 2.0 документация](https://developers.google.com/identity/protocols/oauth2)
