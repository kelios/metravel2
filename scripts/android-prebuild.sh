#!/bin/bash

# Android Prebuild Script для MeTravel
# Подготовка проекта перед сборкой

set -e

# Цвета
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

echo ""
echo "========================================="
echo "  Android Prebuild Script для MeTravel"
echo "========================================="
echo ""

# 1. Проверка зависимостей
log_info "Шаг 1: Проверка зависимостей..."
if ! command -v node &> /dev/null; then
    log_error "Node.js не установлен"
    exit 1
fi

if ! command -v npm &> /dev/null; then
    log_error "npm не установлен"
    exit 1
fi

log_success "Зависимости проверены"

# 2. Очистка кэша
log_info "Шаг 2: Очистка кэша..."
rm -rf node_modules/.cache
rm -rf .expo
rm -rf android/.gradle 2>/dev/null || true
rm -rf android/app/build 2>/dev/null || true
log_success "Кэш очищен"

# 3. Установка зависимостей
log_info "Шаг 3: Установка зависимостей..."
npm install
log_success "Зависимости установлены"

# 4. Проверка конфигурации
log_info "Шаг 4: Проверка конфигурации..."

if [ ! -f "app.json" ]; then
    log_error "app.json не найден"
    exit 1
fi

if [ ! -f "eas.json" ]; then
    log_error "eas.json не найден"
    exit 1
fi

log_success "Конфигурация проверена"

# 5. Проверка переменных окружения
log_info "Шаг 5: Проверка переменных окружения..."

if [ ! -f ".env.prod" ]; then
    log_warning ".env.prod не найден. Создайте файл с production переменными"
else
    log_success ".env.prod найден"
fi

# 6. Проверка Google Services
log_info "Шаг 6: Проверка Google Services..."

if [ ! -f "google-services.json" ]; then
    log_warning "google-services.json не найден"
    log_warning "Скачайте файл из Firebase Console и поместите в корень проекта"
    log_warning "https://console.firebase.google.com/"
else
    log_success "google-services.json найден"
fi

# 7. Запуск expo-doctor
log_info "Шаг 7: Проверка проекта с expo-doctor..."
npx expo-doctor || log_warning "expo-doctor обнаружил предупреждения (проверьте вывод)"

# 8. Проверка иконок и ресурсов
log_info "Шаг 8: Проверка ресурсов..."

if [ ! -f "assets/images/icon.png" ]; then
    log_error "Иконка приложения не найдена: assets/images/icon.png"
    exit 1
fi

if [ ! -f "assets/images/adaptive-icon.png" ]; then
    log_error "Adaptive icon не найден: assets/images/adaptive-icon.png"
    exit 1
fi

if [ ! -f "assets/images/splash.png" ]; then
    log_error "Splash screen не найден: assets/images/splash.png"
    exit 1
fi

log_success "Ресурсы проверены"

# 9. Вывод информации о версии
log_info "Шаг 9: Информация о версии..."

if command -v jq &> /dev/null; then
    VERSION=$(jq -r '.expo.version' app.json)
    VERSION_CODE=$(jq -r '.expo.android.versionCode' app.json)
    PACKAGE=$(jq -r '.expo.android.package' app.json)
    
    echo ""
    echo "  App Name: MeTravel"
    echo "  Version: $VERSION"
    echo "  Version Code: $VERSION_CODE"
    echo "  Package: $PACKAGE"
    echo ""
else
    log_warning "jq не установлен, не могу прочитать версию"
fi

# 10. Проверка keystore (для production)
log_info "Шаг 10: Проверка keystore..."
if [ -f "android-keystore.jks" ]; then
    log_success "Keystore найден: android-keystore.jks"
else
    log_warning "Keystore не найден"
    log_warning "Для production сборки создайте keystore:"
    log_warning "  keytool -genkeypair -v -storetype PKCS12 -keystore android-keystore.jks -alias metravel -keyalg RSA -keysize 2048 -validity 10000"
fi

# 11. Финальная проверка
echo ""
log_success "========================================="
log_success "  Prebuild проверки завершены!"
log_success "========================================="
echo ""
log_info "Проект готов к сборке. Запустите:"
echo "  - Development: ./scripts/android-build.sh (выберите опцию 1)"
echo "  - Preview: ./scripts/android-build.sh (выберите опцию 2)"
echo "  - Production: ./scripts/android-build.sh (выберите опцию 3)"
echo ""
