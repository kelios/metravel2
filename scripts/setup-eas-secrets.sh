#!/bin/bash

# Скрипт для настройки EAS Secrets
# Запускайте этот скрипт ОДИН РАЗ перед первым production деплоем

set -e

echo "========================================="
echo "  EAS Secrets Configuration"
echo "========================================="
echo ""

echo "Этот скрипт настроит секретные переменные для EAS Build/Submit"
echo ""

# Проверка установки EAS CLI
if ! command -v eas &> /dev/null; then
    echo "❌ EAS CLI не установлен"
    echo "Установите: npm install -g eas-cli"
    exit 1
fi

echo "✅ EAS CLI установлен"
echo ""

# Проверка авторизации
echo "Проверка авторизации в EAS..."
if ! eas whoami &> /dev/null; then
    echo "❌ Вы не авторизованы в EAS"
    echo "Запустите: eas login"
    exit 1
fi

echo "✅ Авторизация успешна"
echo ""

# Настройка секретов
echo "========================================="
echo "Настройка секретов:"
echo "========================================="
echo ""

# Google API Secret (если используется)
echo "1. GOOGLE_API_SECRET"
read -p "Введите Google API Secret (или Enter для пропуска): " GOOGLE_SECRET
if [ ! -z "$GOOGLE_SECRET" ]; then
    eas secret:create --scope project --name GOOGLE_API_SECRET --value "$GOOGLE_SECRET" --force
    echo "✅ GOOGLE_API_SECRET настроен"
else
    echo "⏭️  Пропущен"
fi
echo ""

# Route Service Key (OpenRouteService или другой)
echo "2. ROUTE_SERVICE_KEY"
echo "   Получите бесплатный ключ на: https://openrouteservice.org/dev/#/signup"
read -p "Введите Route Service API Key: " ROUTE_KEY
if [ ! -z "$ROUTE_KEY" ]; then
    eas secret:create --scope project --name ROUTE_SERVICE_KEY --value "$ROUTE_KEY" --force
    echo "✅ ROUTE_SERVICE_KEY настроен"
else
    echo "⚠️  ВАЖНО: Настройте позже с помощью:"
    echo "   eas secret:create --scope project --name ROUTE_SERVICE_KEY --value \"YOUR_KEY\""
fi
echo ""

# Firebase/Google Services (если используется)
echo "3. FIREBASE_CONFIG (опционально)"
read -p "Настроить Firebase config? (y/n): " SETUP_FIREBASE
if [ "$SETUP_FIREBASE" = "y" ]; then
    echo "Добавьте firebase конфигурацию вручную:"
    echo "eas secret:create --scope project --name FIREBASE_API_KEY --value \"YOUR_KEY\""
    echo "eas secret:create --scope project --name FIREBASE_PROJECT_ID --value \"YOUR_PROJECT_ID\""
fi
echo ""

echo "========================================="
echo "✅ Секреты настроены!"
echo "========================================="
echo ""
echo "Просмотреть все секреты: eas secret:list"
echo "Удалить секрет: eas secret:delete --name SECRET_NAME"
echo ""
echo "⚠️  ВАЖНО: Не коммитьте .env.prod с секретными ключами в git!"

