#!/bin/bash

# Android Build Script для MeTravel
# Автоматизирует процесс сборки Android приложения

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
    echo "  Android Build Script для MeTravel"
    echo "========================================="
    echo ""
    echo "Выберите профиль сборки:"
    echo ""
    echo "  1) Development (APK для разработки и тестирования)"
    echo "  2) Preview (APK для тестирования на реальных устройствах)"
    echo "  3) Production (AAB для публикации в Google Play)"
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
        VERSION_CODE=$(jq -r '.expo.android.versionCode' app.json)
        echo "  Version: $VERSION"
        echo "  Version Code: $VERSION_CODE"
    else
        log_warning "jq не установлен, не могу прочитать версию автоматически"
        log_info "Проверьте app.json вручную"
    fi
    
    echo ""
    read -p "Хотите обновить версию? (y/n): " update_version
    
    if [ "$update_version" = "y" ]; then
        read -p "Введите новую версию (например, 1.0.1): " new_version
        read -p "Введите новый version code (например, 2): " new_version_code
        
        if command -v jq &> /dev/null; then
            # Обновление с помощью jq
            tmp=$(mktemp)
            jq ".expo.version = \"$new_version\" | .expo.android.versionCode = $new_version_code" app.json > "$tmp"
            mv "$tmp" app.json
            log_success "Версия обновлена: $new_version (versionCode $new_version_code)"
        else
            log_warning "Обновите версию вручную в app.json"
        fi
    fi
}

# Development сборка
build_development() {
    log_info "Запуск Development сборки..."
    log_info "Эта сборка создаст APK для разработки"
    
    eas build --platform android --profile development
    
    log_success "Development сборка завершена!"
    log_info "Скачайте APK и установите на устройство"
}

# Preview сборка
build_preview() {
    log_info "Запуск Preview сборки..."
    log_info "Эта сборка создаст APK для тестирования"
    
    eas build --platform android --profile preview
    
    log_success "Preview сборка завершена!"
    log_info "Скачайте APK и установите на устройство для тестирования"
}

# Production сборка
build_production() {
    log_info "Запуск Production сборки для Google Play..."
    
    echo ""
    log_warning "ВНИМАНИЕ: Это production сборка для Google Play Store!"
    log_warning "Убедитесь, что:"
    echo "  - Версия обновлена"
    echo "  - Все тесты пройдены"
    echo "  - Код готов к публикации"
    echo "  - google-services.json настроен"
    echo "  - Keystore настроен в EAS"
    echo ""
    read -p "Продолжить? (yes/no): " confirm
    
    if [ "$confirm" != "yes" ]; then
        log_info "Сборка отменена"
        return
    fi
    
    check_version
    
    echo ""
    log_info "Production сборка создаст AAB (Android App Bundle)"
    read -p "Автоматически отправить в Google Play Console? (y/n): " auto_submit
    
    if [ "$auto_submit" = "y" ]; then
        log_info "Запуск сборки с автоматической отправкой..."
        eas build --platform android --profile production --auto-submit
    else
        log_info "Запуск сборки без автоматической отправки..."
        eas build --platform android --profile production
        log_info "После завершения отправьте вручную: eas submit --platform android --latest"
    fi
    
    log_success "Production сборка запущена!"
}

# Проверка статуса сборок
check_builds() {
    log_info "Получение списка последних сборок..."
    eas build:list --platform android --limit 10
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
