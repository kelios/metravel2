#!/usr/bin/env bash
# Прогон сценария на ЖИВОМ iPhone поверх уже установленной сборки.
# usage: tools/ios-device-uitests/run.sh '<json-сценарий>' [метка]
set -uo pipefail
ROOT="$(cd "$(dirname "$0")" && pwd)"
OUT="${IOS_QA_OUT:-/tmp/ios-device-qa}"; mkdir -p "$OUT"
LABEL="${2:-run}"
# Дефолт держим отдельной переменной: в ${1:-...} подстановка обрывается на ПЕРВОЙ `}`,
# и хвост JSON-литерала приклеивается к переданному сценарию (ловил на этом парсер).
DEFAULT_SCRIPT='[{"op":"tree"},{"op":"shot","name":"screen"}]'
QA_SCRIPT_JSON="${1:-$DEFAULT_SCRIPT}"

UDID="${IOS_QA_DEVICE:-$(xcrun devicectl list devices 2>/dev/null | awk '/unavailable/{next}{for(i=1;i<=NF;i++) if ($i ~ /^[0-9A-Fa-f]{8}-[0-9A-Fa-f]{4}-/){print $i; exit}}')}"
[ -z "$UDID" ] && { echo "устройство не найдено"; exit 1; }

if xcrun devicectl device info lockState --device "$UDID" 2>/dev/null | grep -q 'passcodeRequired: true'; then
  echo "iPhone ЗАБЛОКИРОВАН — XCUITest не стартует. Разблокируй и поставь Автоблокировку «Никогда»."; exit 2
fi

rm -rf "$OUT/$LABEL.xcresult"
TEST_RUNNER_QA_SCRIPT="$QA_SCRIPT_JSON" \
xcodebuild test \
  -project "$ROOT/MetravelDeviceUITests.xcodeproj" \
  -scheme MetravelDeviceUITests \
  -destination "id=$UDID" \
  -resultBundlePath "$OUT/$LABEL.xcresult" \
  -allowProvisioningUpdates \
  > "$OUT/$LABEL.xcodebuild.log" 2>&1
RC=$?

echo "xcodebuild rc=$RC (полный лог: $OUT/$LABEL.xcodebuild.log)"
grep -E "^QA-STEP|^QA-SHOT|Testing failed|error:|\*\* TEST" "$OUT/$LABEL.xcodebuild.log" | tail -20

# Снимки: забираем PNG из контейнера раннера (дешевле, чем экспорт из xcresult).
mkdir -p "$OUT/$LABEL-shots"
for bid in by.metravel.deviceuitests.xctrunner by.metravel.deviceuitests; do
  xcrun devicectl device copy from --device "$UDID" --domain-type appDataContainer \
    --domain-identifier "$bid" --source Documents --destination "$OUT/$LABEL-shots" >/dev/null 2>&1 && break
done
find "$OUT/$LABEL-shots" -name '*.png' 2>/dev/null | head -10
exit $RC
