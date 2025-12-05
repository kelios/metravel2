#!/bin/bash

# Android Submit Script для MeTravel
# Автоматизирует процесс отправки в Google Play Store

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
echo "  Android Submit Script для MeTravel"
echo "========================================="
echo ""

# Проверка EAS CLI
if ! command -v eas &> /dev/null; then
    log_error "EAS CLI не установлен. Установите: npm install -g eas-cli"
    exit 1
fi

# Проверка Service Account Key
if [ ! -f "google-play-service-account.json" ]; then
    log_error "google-play-service-account.json не найден"
    log_error "Создайте Service Account в Google Play Console:"
    log_error "  1. Откройте Google Play Console"
    log_error "  2. Setup > API access"
    log_error "  3. Create new service account"
    log_error "  4. Grant permissions"
    log_error "  5. Download JSON key"
    exit 1
fi

log_success "Service Account Key найден"

# Меню выбора
echo ""
echo "Выберите действие:"
echo ""
echo "  1) Отправить последнюю сборку в Internal Testing"
echo "  2) Отправить последнюю сборку в Closed Testing (Alpha)"
echo "  3) Отправить последнюю сборку в Open Testing (Beta)"
echo "  4) Отправить последнюю сборку в Production"
echo "  5) Отправить конкретную сборку (по ID)"
echo "  6) Выход"
echo ""
read -p "Ваш выбор [1-6]: " choice

case $choice in
    1)
        log_info "Отправка в Internal Testing..."
        eas submit --platform android --latest --track internal
        log_success "Приложение отправлено в Internal Testing!"
        ;;
    2)
        log_info "Отправка в Closed Testing (Alpha)..."
        eas submit --platform android --latest --track alpha
        log_success "Приложение отправлено в Alpha Testing!"
        ;;
    3)
        log_info "Отправка в Open Testing (Beta)..."
        eas submit --platform android --latest --track beta
        log_success "Приложение отправлено в Beta Testing!"
        ;;
    4)
        log_warning "ВНИМАНИЕ: Отправка в Production!"
        read -p "Вы уверены? (yes/no): " confirm
        if [ "$confirm" = "yes" ]; then
            log_info "Отправка в Production..."
            eas submit --platform android --latest --track production
            log_success "Приложение отправлено в Production!"
        else
            log_info "Отправка отменена"
        fi
        ;;
    5)
        read -p "Введите Build ID: " build_id
        read -p "Выберите track (internal/alpha/beta/production): " track
        log_info "Отправка сборки $build_id в $track..."
        eas submit --platform android --id "$build_id" --track "$track"
        log_success "Сборка отправлена!"
        ;;
    6)
        log_info "Выход..."
        exit 0
        ;;
    *)
        log_error "Неверный выбор"
        exit 1
        ;;
esac

echo ""
log_info "Проверьте статус в Google Play Console:"
log_info "https://play.google.com/console"
echo ""
