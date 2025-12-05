#!/bin/bash

# iOS Submit Script для MeTravel
# Автоматизирует отправку сборки в App Store Connect

set -e

# Цвета для вывода
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

# Проверка EAS CLI
if ! command -v eas &> /dev/null; then
    log_error "EAS CLI не установлен. Установите: npm install -g eas-cli"
    exit 1
fi

echo ""
echo "========================================="
echo "  iOS Submit Script для MeTravel"
echo "========================================="
echo ""

# Показать последние сборки
log_info "Последние iOS сборки:"
eas build:list --platform ios --limit 5

echo ""
echo "Выберите действие:"
echo ""
echo "  1) Отправить последнюю сборку"
echo "  2) Отправить конкретную сборку по ID"
echo "  3) Выход"
echo ""
read -p "Ваш выбор [1-3]: " choice

case $choice in
    1)
        log_info "Отправка последней сборки в App Store Connect..."
        eas submit --platform ios --latest
        log_success "Сборка отправлена!"
        ;;
    2)
        read -p "Введите Build ID: " build_id
        log_info "Отправка сборки $build_id в App Store Connect..."
        eas submit --platform ios --id "$build_id"
        log_success "Сборка отправлена!"
        ;;
    3)
        log_info "Выход..."
        exit 0
        ;;
    *)
        log_error "Неверный выбор"
        exit 1
        ;;
esac

echo ""
log_info "Следующие шаги:"
echo "  1. Откройте App Store Connect: https://appstoreconnect.apple.com"
echo "  2. Выберите ваше приложение MeTravel"
echo "  3. Дождитесь обработки сборки (обычно 10-30 минут)"
echo "  4. Заполните метаданные и отправьте на ревью"
echo ""
