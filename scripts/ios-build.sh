#!/bin/bash

# iOS Build Script для MeTravel
# Автоматизирует процесс сборки iOS приложения

set -e  # Остановка при ошибке

# Цвета для вывода
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Функция для вывода сообщений
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

# Проверка наличия необходимых инструментов
check_dependencies() {
    log_info "Проверка зависимостей..."
    
    if ! command -v node &> /dev/null; then
        log_error "Node.js не установлен"
        exit 1
    fi
    
    if ! command -v npm &> /dev/null; then
        log_error "npm не установлен"
        exit 1
    fi
    
    if ! command -v eas &> /dev/null; then
        log_error "EAS CLI не установлен. Установите: npm install -g eas-cli"
        exit 1
    fi
    
    log_success "Все зависимости установлены"
}

# Показать меню выбора профиля
show_menu() {
    echo ""
    echo "========================================="
    echo "  iOS Build Script для MeTravel"
    echo "========================================="
    echo ""
    echo "Выберите профиль сборки:"
    echo ""
    echo "  1) Development (для разработки и тестирования на симуляторе)"
    echo "  2) Preview (для тестирования на реальных устройствах)"
    echo "  3) Production (для публикации в App Store)"
    echo "  4) Проверить статус сборок"
    echo "  5) Выход"
    echo ""
    read -p "Ваш выбор [1-5]: " choice
}

# Проверка и обновление версии
check_version() {
    log_info "Текущая версия из app.json:"
    
    if command -v jq &> /dev/null; then
        VERSION=$(jq -r '.expo.version' app.json)
        BUILD_NUMBER=$(jq -r '.expo.ios.buildNumber' app.json)
        echo "  Version: $VERSION"
        echo "  Build Number: $BUILD_NUMBER"
    else
        log_warning "jq не установлен, не могу прочитать версию автоматически"
        log_info "Проверьте app.json вручную"
    fi
    
    echo ""
    read -p "Хотите обновить версию? (y/n): " update_version
    
    if [ "$update_version" = "y" ]; then
        read -p "Введите новую версию (например, 1.0.1): " new_version
        read -p "Введите новый build number (например, 2): " new_build
        
        if command -v jq &> /dev/null; then
            # Обновление с помощью jq
            tmp=$(mktemp)
            jq ".expo.version = \"$new_version\" | .expo.ios.buildNumber = \"$new_build\"" app.json > "$tmp"
            mv "$tmp" app.json
            log_success "Версия обновлена: $new_version (build $new_build)"
        else
            log_warning "Обновите версию вручную в app.json"
        fi
    fi
}

# Development сборка
build_development() {
    log_info "Запуск Development сборки..."
    log_info "Эта сборка будет работать только на симуляторе"
    
    eas build --platform ios --profile development
    
    log_success "Development сборка завершена!"
    log_info "Установите на симулятор командой: eas build:run -p ios"
}

# Preview сборка
build_preview() {
    log_info "Запуск Preview сборки..."
    log_info "Эта сборка для тестирования на реальных устройствах"
    
    eas build --platform ios --profile preview
    
    log_success "Preview сборка завершена!"
    log_info "Скачайте .ipa файл и установите через Xcode или TestFlight"
}

# Production сборка
build_production() {
    log_info "Запуск Production сборки для App Store..."
    
    echo ""
    log_warning "ВНИМАНИЕ: Это production сборка для App Store!"
    log_warning "Убедитесь, что:"
    echo "  - Версия обновлена"
    echo "  - Все тесты пройдены"
    echo "  - Код готов к публикации"
    echo ""
    read -p "Продолжить? (yes/no): " confirm
    
    if [ "$confirm" != "yes" ]; then
        log_info "Сборка отменена"
        return
    fi
    
    check_version
    
    echo ""
    read -p "Автоматически отправить в App Store Connect? (y/n): " auto_submit
    
    if [ "$auto_submit" = "y" ]; then
        log_info "Запуск сборки с автоматической отправкой..."
        eas build --platform ios --profile production --auto-submit
    else
        log_info "Запуск сборки без автоматической отправки..."
        eas build --platform ios --profile production
        log_info "После завершения отправьте вручную: eas submit --platform ios --latest"
    fi
    
    log_success "Production сборка запущена!"
}

# Проверка статуса сборок
check_builds() {
    log_info "Получение списка последних сборок..."
    eas build:list --platform ios --limit 10
}

# Основная логика
main() {
    check_dependencies
    
    while true; do
        show_menu
        
        case $choice in
            1)
                build_development
                ;;
            2)
                build_preview
                ;;
            3)
                build_production
                ;;
            4)
                check_builds
                ;;
            5)
                log_info "Выход..."
                exit 0
                ;;
            *)
                log_error "Неверный выбор. Попробуйте снова."
                ;;
        esac
        
        echo ""
        read -p "Нажмите Enter для продолжения..."
    done
}

# Запуск скрипта
main
