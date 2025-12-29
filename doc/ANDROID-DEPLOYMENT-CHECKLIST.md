# 🎯 Android Deploy - Action Checklist

## ✅ QUICK START (Быстрый старт)

### 1. Обновить app.json
```bash
# Отредактируйте /Users/juliasavran/Sites/metravel2/metravel2/app.json
```

**Измените:**
```json
{
  "expo": {
    "name": "MeTravel",
    "description": "Discover and share travel experiences",
    "privacy": "https://metravel.by/privacy",
    
    "android": {
      "package": "com.metravel.app",  // ← Измените это!
      "versionCode": 1,
      "minSdkVersion": 24,
      "targetSdkVersion": 35,         // ← Может быть 34, проверьте build.gradle
      "privacyUrl": "https://metravel.by/privacy"
    }
  }
}
```

### 2. Получить Google Maps API Key

```bash
# Переходите на: https://console.cloud.google.com/
# 1. Create new project → "MeTravel"
# 2. APIs & Services → Maps SDK for Android (Enable)
# 3. Create API Key (Android)
# 4. Add key to app.json:
```

```json
{
  "android": {
    "config": {
      "googleMaps": {
        "apiKey": "AIzaSy..."  // ← Вставьте вашу ключ здесь
      }
    }
  }
}
```

### 3. Создать Google Play Console запись

```bash
# Переходите на: https://play.google.com/console/
# 1. Create app
# 2. Укажите название: "MeTravel"
# 3. Категория: Travel
# 4. Заполните Store listing
```

### 4. Собрать и тестировать

```bash
# Собрать Preview APK для тестирования
npm run android:build:preview

# Дождаться сборки, затем:
# 1. Скачайте APK с EAS
# 2. Установите на Android устройство
# 3. Протестируйте все функции
```

### 5. Собрать Production AAB

```bash
# При готовности к публикации
npm run android:build:prod

# Это создаст AAB (Android App Bundle) для Google Play
```

### 6. Отправить в Play Store

```bash
# Опционально: автоматическая отправка
npm run android:submit:latest

# Или вручную загрузить в Google Play Console
```

---

## 📋 ДЕТАЛЬНЫЙ ЧЕКЛИСТ

### Раздел 1: Конфигурация (1-2 часа)

#### 1.1 Обновить app.json ✅

- [ ] Открить `/metravel2/app.json`
- [ ] Изменить `"package": "com.yourcompany.metravel"` на уникальное имя (например, `com.metravel.app`)
- [ ] Добавить `"privacy": "https://metravel.by/privacy"`
- [ ] Убедиться что `targetSdkVersion` >= 34 (Google Play требует 35+)
- [ ] Добавить `"description": "Discover and share travel experiences"`
- [ ] Проверить что все разрешения корректны

**Пример корректного app.json:**
```json
{
  "expo": {
    "name": "MeTravel",
    "slug": "metravel",
    "version": "1.0.0",
    "description": "Discover and share travel experiences",
    "privacy": "https://metravel.by/privacy",
    "android": {
      "package": "com.metravel.app",
      "versionCode": 1,
      "minSdkVersion": 24,
      "targetSdkVersion": 35,
      "privacyUrl": "https://metravel.by/privacy",
      "permissions": [...]
    }
  }
}
```

#### 1.2 Создать .env.prod ⚠️

- [ ] Скопировать `.env.production.example` (если существует) или создать новый файл
- [ ] Добавить переменные окружения:

```bash
# .env.prod
EXPO_PUBLIC_API_URL=https://api.metravel.by
EXPO_PUBLIC_ANALYTICS_ID=
EXPO_PUBLIC_APP_ENV=production
NODE_ENV=production
```

#### 1.3 Gradle конфигурация ⚠️

- [ ] Проверить `/android/build.gradle`
- [ ] Убедиться что `targetSdkVersion = 35` (не 34)
- [ ] Убедиться что `minSdkVersion = 24` (Android 7.0+)
- [ ] Убедиться что 64-bit поддержка включена

---

### Раздел 2: Google Services (2-4 часа)

#### 2.1 Google Maps API Key ❌

- [ ] Перейти на https://console.cloud.google.com/
- [ ] Create new project → "MeTravel"
- [ ] Enable APIs:
  - [ ] Maps SDK for Android
  - [ ] Maps SDK for iOS
- [ ] Create API Key (type: Android)
- [ ] Ограничить ключ на Maps APIs только
- [ ] Добавить SHA-1 fingerprint
  ```bash
  # Для Expo EAS используется:
  # Получите от EAS при первой сборке
  ```
- [ ] Скопировать ключ
- [ ] Добавить в app.json:
  ```json
  "config": {
    "googleMaps": {
      "apiKey": "AIzaSy..."
    }
  }
  ```

#### 2.2 Firebase (Опционально) ❌

- [ ] Перейти на https://console.firebase.google.com/
- [ ] Create project → "MeTravel"
- [ ] Добавить Android приложение
- [ ] Скачать `google-services.json`
- [ ] Положить в корень проекта
- [ ] Установить Firebase пакеты (если нужны):
  ```bash
  npm install firebase @react-native-firebase/app @react-native-firebase/analytics
  ```

#### 2.3 Google Play Service Account ❌

- [ ] Перейти на https://play.google.com/console/
- [ ] Setup → API access
- [ ] Create new Service Account
- [ ] Grant permissions:
  - [ ] Release Manager
  - [ ] Edit store listing
- [ ] Download JSON key
- [ ] Сохранить как `google-play-service-account.json` в корень проекта
- [ ] ВАЖНО: Добавить в `.gitignore` (уже добавлено)

---

### Раздел 3: Google Play Console (1-3 часа)

#### 3.1 Создать приложение ❌

- [ ] Перейти на https://play.google.com/console/
- [ ] Create app
- [ ] Название: "MeTravel"
- [ ] Категория: Travel
- [ ] Описание: "Discover and share travel experiences"

#### 3.2 Заполнить Store listing ❌

- [ ] **App name:** "MeTravel" (max 50 chars)
- [ ] **Short description:** (max 80 chars)
  ```
  Discover travel experiences, share moments
  ```
- [ ] **Full description:** (max 4000 chars)
  ```
  MeTravel is your personal travel companion for discovering 
  and sharing amazing travel experiences. Explore destinations, 
  save your favorites, and connect with other travelers.
  
  Features:
  - Discover travel destinations
  - Save favorites
  - Share your experiences
  - Real-time location tracking
  - Photo gallery
  - Travel recommendations
  ```
- [ ] **Privacy policy:** https://metravel.by/privacy
- [ ] **Terms of service:** https://metravel.by/terms (если есть)

#### 3.3 Добавить скриншоты и видео ❌

- [ ] Минимум 5 скриншотов (максимум 8)
- [ ] Размер: 1080 x 1920 px (для 5.5" экранов)
- [ ] Скриншоты должны быть на основном языке приложения
- [ ] Опционально: Видео preview (max 30 сек)

**Скриншоты:**
1. Main home screen
2. Travel list
3. Map view
4. Travel details
5. User profile

#### 3.4 Заполнить Content rating questionnaire ❌

- [ ] Перейти на https://play.google.com/console/ → Content Rating
- [ ] Заполнить questionnaire
- [ ] Отправить форму
- [ ] Дождаться результатов

#### 3.5 Установить контакты для разработчика ❌

- [ ] Email
- [ ] Website
- [ ] Phone (опционально)

#### 3.6 Указать цену и доступность ❌

- [ ] Выбрать: Free или Paid
- [ ] Страны где доступно: All (или выбрать конкретные)

---

### Раздел 4: Локальная сборка (2-3 часа)

#### 4.1 Проверить зависимости ✅

```bash
cd /Users/juliasavran/Sites/metravel2/metravel2
npm install
```

- [ ] Убедиться что npm install прошло успешно
- [ ] Проверить что нет критических ошибок

#### 4.2 Установить EAS CLI ✅

```bash
npm install -g eas-cli
eas login
```

- [ ] EAS CLI установлен глобально
- [ ] Вы залогинены в Expo аккаунт

#### 4.3 Запустить prebuild проверку ✅

```bash
npm run android:prebuild
# или
./scripts/android-prebuild.sh
```

- [ ] Проверка прошла без ошибок
- [ ] Нет предупреждений о конфигурации

---

### Раздел 5: Тестирование (2-8 часов)

#### 5.1 Собрать Preview APK ⚠️

```bash
npm run android:build:preview
# или
./scripts/android-build.sh
# Выбрать: 2) Preview
```

- [ ] Сборка запущена
- [ ] Дождаться завершения (обычно 10-20 минут)
- [ ] EAS будет отправлять обновления статуса

#### 5.2 Скачать и установить APK ⚠️

```bash
# 1. Перейти на https://expo.dev/builds
# 2. Найти последнюю preview сборку
# 3. Скачать APK
# 4. Установить на Android устройство

adb install path/to/app.apk

# или просто открыть ссылку на устройстве
```

- [ ] APK скачана
- [ ] APK установлена на тестовом устройстве

#### 5.3 Провести функциональное тестирование ⚠️

**Базовые функции:**
- [ ] Приложение запускается без ошибок
- [ ] Splash screen отображается корректно
- [ ] Логин/регистрация работает
- [ ] Home screen загружается

**Локация и GPS:**
- [ ] Запрос на доступ к локации работает
- [ ] GPS включается при необходимости
- [ ] Map отображается с текущей локацией

**Галерея и фото:**
- [ ] Открытие галереи работает
- [ ] Загрузка фото работает
- [ ] HEIC конвертация работает (если применимо)

**Основные экраны:**
- [ ] Home screen
- [ ] Travel list
- [ ] Map view
- [ ] Travel details
- [ ] Profile
- [ ] Settings

**Разрешения:**
- [ ] Camera: ✓ запрос и функциональность
- [ ] Location: ✓ запрос и функциональность
- [ ] Files: ✓ чтение и запись

**Производительность:**
- [ ] Нет lag при скроллинге
- [ ] Нет зависаний при загрузке
- [ ] Нет утечек памяти

#### 5.4 Проверить Deep linking ⚠️

```bash
# На устройстве
adb shell am start -a android.intent.action.VIEW \
  -d "https://metravel.by/" com.metravel.app

adb shell am start -a android.intent.action.VIEW \
  -d "https://metravel.by/travel/123" com.metravel.app
```

- [ ] Deep links открываются правильно
- [ ] Соответствующие экраны загружаются

#### 5.5 Логирование ошибок ⚠️

```bash
# Собрать логи с устройства
adb logcat > android-logs.txt

# Проверить на ошибки
grep ERROR android-logs.txt | head -20
```

- [ ] Нет критических ошибок в логах
- [ ] Нет ANR (Application Not Responding)
- [ ] Нет crash'ей

---

### Раздел 6: Сборка Production AAB (30-60 минут)

#### 6.1 Обновить версию ⚠️

- [ ] Увеличить `version` в app.json (например, с 1.0.0 на 1.0.1)
- [ ] Увеличить `android.versionCode` (например, с 1 на 2)

```json
{
  "version": "1.0.1",
  "android": {
    "versionCode": 2
  }
}
```

#### 6.2 Собрать Production AAB ⚠️

```bash
npm run android:build:prod
# или
./scripts/android-build.sh
# Выбрать: 3) Production
```

- [ ] Production сборка запущена
- [ ] Дождаться завершения (обычно 15-30 минут)
- [ ] Проверить статус на https://expo.dev/builds

#### 6.3 Скачать AAB ⚠️

- [ ] Перейти на https://expo.dev/builds
- [ ] Найти Production AAB
- [ ] Скачать файл

---

### Раздел 7: Загрузка в Google Play (30-60 минут)

#### 7.1 Ручная загрузка AAB ⚠️

```bash
# 1. Перейти на https://play.google.com/console/
# 2. Выбрать приложение "MeTravel"
# 3. Release → Production
# 4. Create new release
# 5. Upload AAB файл
# 6. Добавить release notes
# 7. Review and publish
```

- [ ] AAB загружена
- [ ] Release notes добавлены
- [ ] Все обязательные поля заполнены

#### 7.2 Или использовать автоматическую отправку ⚠️

```bash
npm run android:submit:latest

# При запросе выбрать:
# Track: production (или alpha/beta для тестирования)
```

- [ ] Выбран правильный track
- [ ] Отправка начала
- [ ] Дождаться завершения

#### 7.3 Проверить статус ⚠️

```bash
# Перейти на https://play.google.com/console/
# Release → Production
# Проверить статус приложения
```

- [ ] Статус: "In review" или "Approved"
- [ ] Нет ошибок валидации
- [ ] Ожидание: обычно 24-48 часов

---

### Раздел 8: Post-Launch (После публикации)

#### 8.1 Мониторинг ⚠️

- [ ] Проверить Google Play Console ежедневно
- [ ] Следить за рейтингами пользователей
- [ ] Читать reviews и отвечать на них
- [ ] Мониторить crashes (в Google Play Console)

#### 8.2 Обновления ❌

- [ ] При необходимости исправления: повторить шаги 6-7
- [ ] Всегда увеличивать `versionCode`
- [ ] Следить за feedback пользователей

---

## 🎯 КРИТИЧЕСКИЕ ТРЕБОВАНИЯ (MUST DO)

### Минимальные требования для публикации:

1. ✅ **app.json конфигурация**
   ```json
   {
     "package": "com.metravel.app",        // ← Уникальное имя
     "privacy": "https://metravel.by/privacy",
     "targetSdkVersion": 35
   }
   ```

2. ❌ **Google Maps API Key**
   ```json
   "googleMaps": { "apiKey": "AIzaSy..." }
   ```

3. ❌ **Google Play Console запись**
   - Созданное приложение
   - Заполненный Store listing
   - Минимум 5 скриншотов

4. ❌ **Content Rating**
   - Заполненный questionnaire

5. ❌ **Privacy Policy**
   - Доступна по URL в app.json

6. ✅ **Скрипты сборки**
   - Все скрипты готовы в `/scripts`

---

## 📞 ПОМОЩЬ И ПОДДЕРЖКА

### Если возникают проблемы:

```bash
# 1. Проверить logs
npm run android:prebuild

# 2. Очистить кэш
npm run clean

# 3. Переустановить зависимости
npm install

# 4. Проверить конфигурацию
npx expo-doctor

# 5. Собрать с debug логами
EAS_DEBUG=1 npm run android:build:preview
```

### Полезные команды:

```bash
# Все доступные команды
grep "android:" package.json | grep scripts

# Статус текущих сборок
eas build --status

# История сборок
eas build --status --platform android

# Логи последней сборки
eas build:view
```

### Контакты поддержки:

- Expo Docs: https://docs.expo.dev/
- Google Play Help: https://support.google.com/googleplay/
- EAS CLI Support: https://docs.expo.dev/build/setup/

---

## ✨ УСПЕШНО ОПУБЛИКОВАННОГО! 

Когда приложение опубликовано:
- ✅ Поделитесь ссылкой Play Store со своей командой
- ✅ Обновите README с ссылкой на приложение
- ✅ Отслеживайте метрики в Google Play Console
- ✅ Готовьте обновления на основе feedback

**Play Store ссылка:**
```
https://play.google.com/store/apps/details?id=com.metravel.app
```

---

**Последнее обновление:** 29 декабря 2025

