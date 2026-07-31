#!/bin/bash
# Срочный фикс: скопировать новый CustomHeader chunk как старый
# Это решит проблему для пользователей с закэшированным старым _layout chunk

set -e

# Адрес сервера не зашит в скрипт: репозиторий публичный. Реквизиты приходят
# из .env.deploy или окружения — см. scripts/deploy-target.sh.
# shellcheck source=scripts/deploy-target.sh
source "$(dirname "${BASH_SOURCE[0]}")/deploy-target.sh"
require_deploy_target

OLD_CHUNK="CustomHeader-35c08b6fda505a901ff6d2adcd502571.js"
NEW_CHUNK="CustomHeader-c172213d0a07765fd9eee66b10d66ebf.js"
CHUNK_DIR="$PROD_REMOTE_DIR/static/dist/_expo/static/js/web"

echo "Копирую $NEW_CHUNK как $OLD_CHUNK..."

ssh "$PROD_SSH_TARGET" "
  cd $CHUNK_DIR
  if [ -f '$NEW_CHUNK' ]; then
    cp '$NEW_CHUNK' '$OLD_CHUNK'
    echo 'Готово! Старый chunk теперь доступен.'
    ls -la | grep CustomHeader
  else
    echo 'ОШИБКА: Новый chunk $NEW_CHUNK не найден!'
    ls -la | grep CustomHeader || echo 'Нет CustomHeader chunks'
  fi
"
