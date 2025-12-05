#!/bin/bash

# iOS Prebuild Script для MeTravel
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
echo "  iOS Prebuild Script для MeTravel"
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

# 6. Запуск expo-doctor
log_info "Шаг 6: Проверка проекта с expo-doctor..."
npx expo-doctor || log_warning "expo-doctor обнаружил предупреждения (проверьте вывод)"

# 7. Проверка иконок и ресурсов
log_info "Шаг 7: Проверка ресурсов..."

if [ ! -f "assets/images/icon.png" ]; then
    log_error "Иконка приложения не найдена: assets/images/icon.png"
    exit 1
fi

if [ ! -f "assets/images/splash.png" ]; then
    log_error "Splash screen не найден: assets/images/splash.png"
    exit 1
fi

log_success "Ресурсы проверены"

# 8. Вывод информации о версии
log_info "Шаг 8: Информация о версии..."

if command -v jq &> /dev/null; then
    VERSION=$(jq -r '.expo.version' app.json)
    BUILD_NUMBER=$(jq -r '.expo.ios.buildNumber' app.json)
    BUNDLE_ID=$(jq -r '.expo.ios.bundleIdentifier' app.json)
    
    echo ""
    echo "  App Name: MeTravel"
    echo "  Version: $VERSION"
    echo "  Build Number: $BUILD_NUMBER"
    echo "  Bundle ID: $BUNDLE_ID"
    echo ""
else
    log_warning "jq не установлен, не могу прочитать версию"
fi

# 9. Финальная проверка
echo ""
log_success "========================================="
log_success "  Prebuild проверки завершены!"
log_success "========================================="
echo ""
log_info "Проект готов к сборке. Запустите:"
echo "  - Development: ./scripts/ios-build.sh (выберите опцию 1)"
echo "  - Preview: ./scripts/ios-build.sh (выберите опцию 2)"
echo "  - Production: ./scripts/ios-build.sh (выберите опцию 3)"
echo ""
