# MeTravel - Android Build & Deploy

Это приложение настроено для сборки и публикации в Google Play Store через Expo EAS Build.

## 🚀 Быстрый старт

### Первая сборка (Development)

```bash
# 1. Установите зависимости
npm install

# 2. Установите EAS CLI (если ещё не установлен)
npm install -g eas-cli

# 3. Войдите в Expo
eas login

# 4. Соберите APK для тестирования
npm run android:build:dev
```

### Production сборка

```bash
# Запустите интерактивный скрипт
./scripts/android-build.sh

# Или напрямую
npm run android:build:prod
```

## 📋 Необходимые файлы

Перед production сборкой создайте эти файлы из шаблонов:

### 1. google-services.json
```bash
# Скачайте из Firebase Console
# https://console.firebase.google.com/
# Поместите в корень проекта
```

### 2. .env.prod
```bash
cp .env.production.example .env.prod
# Отредактируйте и добавьте ваши ключи
```

### 3. google-play-service-account.json (для автоматической публикации)
```bash
# Создайте Service Account в Google Play Console
# Setup > API access > Create new service account
# Скачайте JSON ключ и поместите в корень
```

## 📱 Доступные команды

### Prebuild
```bash
npm run android:prebuild          # Проверка перед сборкой
./scripts/android-prebuild.sh     # То же самое
```

### Build
```bash
npm run android:build:dev         # Development APK
npm run android:build:preview     # Preview APK
npm run android:build:prod        # Production AAB

./scripts/android-build.sh        # Интерактивное меню
```

### Submit
```bash
npm run android:submit:latest     # Отправить последнюю сборку
./scripts/android-submit.sh       # Интерактивное меню
```

### Мультиплатформенная сборка
```bash
npm run build:all:dev            # iOS + Android (Development)
npm run build:all:preview        # iOS + Android (Preview)
npm run build:all:prod           # iOS + Android (Production)
```

## 🔧 Конфигурация

### app.json
Основная конфигурация Android находится в `app.json`:

```json
{
  "expo": {
    "android": {
      "package": "com.yourcompany.metravel",
      "versionCode": 1,
      "permissions": [...],
      "config": {
        "googleMaps": {
          "apiKey": "YOUR_KEY"
        }
      }
    }
  }
}
```

### eas.json
Профили сборки настроены в `eas.json`:

- **development**: APK для разработки
- **preview**: APK для тестирования
- **production**: AAB для Google Play Store

## 📚 Документация

- **Полная карта документации**: [docs/INDEX.md](./docs/INDEX.md)
- **Базовый гайд проекта**: [docs/README.md](./docs/README.md)

## 🔐 Безопасность

Следующие файлы содержат конфиденциальные данные и **НЕ должны** коммититься в Git:

- `google-services.json`
- `google-play-service-account.json`
- `android-keystore.jks`
- `.env.prod`

Все они уже добавлены в `.gitignore`.

## 🐛 Troubleshooting

### Ошибка: "google-services.json not found"
Скачайте файл из Firebase Console и поместите в корень проекта.

### Ошибка: "Package name mismatch"
Убедитесь, что package name одинаковый в `app.json`, `google-services.json` и Google Play Console.

### Ошибка сборки
```bash
# Очистите кэш
npm run clean
eas build --platform android --profile production --clear-cache
```

Подробнее см. [базовый troubleshooting в docs](./docs/README.md)

## 📞 Поддержка

- [Expo Documentation](https://docs.expo.dev/)
- [EAS Build](https://docs.expo.dev/build/introduction/)
- [Google Play Console Help](https://support.google.com/googleplay/android-developer)

---

**Версия**: 1.0.0  
**Последнее обновление**: Декабрь 2024
