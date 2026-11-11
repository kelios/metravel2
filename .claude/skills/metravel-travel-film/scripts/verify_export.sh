#!/bin/bash
# Проверка готового экспорта: полное декодирование, длительности, чёрные и
# застывшие кадры, громкость, листы кадров. Файл только читается.
#
# Запуск: verify_export.sh <export.mp4> <outdir> [шаг_кадров_сек=5]
set -uo pipefail
VIDEO="$(cd "$(dirname "$1")" && pwd)/$(basename "$1")"; OUT="$2"; STEP="${3:-5}"
HERE="$(cd "$(dirname "$0")" && pwd)"
mkdir -p "$OUT/frames" "$OUT/sheets"
cd "$OUT"
# кадры прошлой проверки попали бы на листы более короткого экспорта
rm -f frames/t_*.jpg sheets/sheet_*.jpg

echo "== потоки"
ffprobe -v error -show_entries stream=codec_type,codec_name,profile,width,height,r_frame_rate,sample_rate,duration \
  -show_entries format=duration,size,bit_rate -of default=nw=1 "$VIDEO" | tr '\n' ' '; echo

echo "== полное декодирование, кадры, чёрные и застывшие кадры"
ffmpeg -hide_banner -nostdin -y -v error -hwaccel videotoolbox -i "$VIDEO" \
  -filter_complex "[0:v]scale=320:180,split=2[b][c];[b]fps=1/${STEP}[t];[c]blackdetect=d=0.03:pix_th=0.10,freezedetect=n=0.003:d=2,metadata=print:file=freeze.txt[f]" \
  -map "[t]" -q:v 4 frames/t_%04d.jpg -map "[f]" -f null - -map 0:a -f null - 2> decode_errors.txt
echo "код завершения: $?; строк с ошибками: $(wc -l < decode_errors.txt | tr -d ' ')"
grep -E "black_start|black_end" freeze.txt | sed 's/lavfi\.//' | paste - - | head -60

echo "== громкость"
ffmpeg -hide_banner -nostdin -i "$VIDEO" -vn -af ebur128=peak=true -f null - 2>&1 | tail -20 | grep -E "I:|LRA:|Peak:" | tr -s ' '

uv run -q --with pillow "$HERE/contact_sheets.py" frames sheets --step "$STEP" > sheets/index.txt
echo "== листы: $OUT/sheets ($(wc -l < sheets/index.txt | tr -d ' ') шт.)"
