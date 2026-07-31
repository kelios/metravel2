#!/bin/bash
# Ставит в PATH тот Node, который требует проект, и GNU-совместимый rsync.
#
# Зачем
# -----
# На этой машине `/opt/homebrew/bin/node` — симлинк на `node@20`, а нужный
# `node@22` установлен keg-only и в PATH не попадает. Менеджера версий нет,
# поэтому `.nvmrc` и `.node-version` в репозитории никто не читает. Итог: любой
# новый шелл даёт Node 20, и `yarn install` внутри `build-prod.sh` падает на
# `ensure-node-version.js` ещё до сборки — деплой не доходит до прода вообще.
#
# Раньше это лечили руками (`export PATH=...` перед каждым запуском), и забыть
# было легко: сообщение об ошибке появляется через минуту после старта, когда
# уже кажется, что всё идёт нормально.
#
# Поиск версии не дублируется: `ensure-node-version.js --print-bin-dir` отдаёт
# каталог, который он же и считает подходящим, — проверяя реальным `node -v`,
# а не по имени каталога.
#
# Про rsync
# ---------
# `build-prod.sh` синхронизирует сборку через `rsync -avzhe ssh --delete`.
# В macOS `/usr/bin/rsync` — это openrsync, и он раньше `/opt/homebrew/bin`
# в PATH. GNU rsync лежит в Homebrew; ставим его вперёд, чтобы поведение флагов
# совпадало с тем, на котором скрипт писался и проверялся.
#
# Использование
# -------------
#     source "$(dirname "${BASH_SOURCE[0]}")/scripts/use-node.sh"
#
# Скрипт идемпотентен и молчит, когда всё уже правильно.

_use_node_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

_use_node_prepend() {
  # Добавляем каталог в начало PATH, не плодя дубликатов.
  case ":$PATH:" in
    *":$1:"*) PATH="$(printf '%s' "$PATH" | tr ':' '\n' | grep -vxF "$1" | paste -sd: -)" ;;
  esac
  export PATH="$1:$PATH"
}

# --- Node -------------------------------------------------------------------
if ! node "$_use_node_root/scripts/ensure-node-version.js" >/dev/null 2>&1; then
  _use_node_bin="$(node "$_use_node_root/scripts/ensure-node-version.js" --print-bin-dir 2>/dev/null)"
  if [[ -n "$_use_node_bin" && -x "$_use_node_bin/node" ]]; then
    _use_node_prepend "$_use_node_bin"
    echo "use-node: Node $(node -v) из $_use_node_bin"
  else
    echo "use-node: подходящий Node не найден — запусти ensure-node-version.js и следуй подсказке" >&2
  fi
fi

# --- rsync ------------------------------------------------------------------
# Только если GNU-версия действительно установлена; иначе оставляем как есть.
for _use_node_rsync_dir in /opt/homebrew/bin /usr/local/bin; do
  if [[ -x "$_use_node_rsync_dir/rsync" ]] \
     && "$_use_node_rsync_dir/rsync" --version 2>/dev/null | head -1 | grep -q '^rsync  *version'; then
    if ! rsync --version 2>/dev/null | head -1 | grep -q '^rsync  *version'; then
      _use_node_prepend "$_use_node_rsync_dir"
      echo "use-node: rsync $("$_use_node_rsync_dir/rsync" --version | head -1 | awk '{print $3}') из $_use_node_rsync_dir"
    fi
    break
  fi
done

unset _use_node_root _use_node_bin _use_node_rsync_dir
