#!/bin/bash
# Просмотр готового фильма: звук, расшифровка речи, кадры через равный шаг,
# склейки, чёрные и застывшие кадры, громкость. Исходный файл только читается.
#
# Запуск: watch_film.sh <video> <workdir> [шаг_кадров_сек=5] [язык=ru] ["подсказка для расшифровки"]
# Нужны: ffmpeg, uv, mlx_whisper (uv tool install --python 3.12 mlx-whisper).
# Результат в <workdir>: audio_full.wav, audio16k.wav, loudness.txt, silence.txt,
# frames/t_NNNN.jpg, sheets/sheet_NNNN.jpg, scenes.txt, freeze.txt, tr/audio16k.{json,srt,txt}
set -euo pipefail
VIDEO="$(cd "$(dirname "$1")" && pwd)/$(basename "$1")"; WORK="$2"; STEP="${3:-5}"; LANGUAGE="${4:-ru}"; PROMPT="${5:-}"
HERE="$(cd "$(dirname "$0")" && pwd)"
mkdir -p "$WORK/frames" "$WORK/sheets" "$WORK/tr"
cd "$WORK"
# кадры и листы прошлого прохода попали бы на листы более короткого фильма
rm -f frames/t_*.jpg sheets/sheet_*.jpg

# 1. Звук: полный WAV для измерений и 16 кГц моно для расшифровки.
ffmpeg -hide_banner -nostdin -y -loglevel error -i "$VIDEO" \
  -vn -ac 1 -ar 16000 audio16k.wav -vn -c:a pcm_s16le audio_full.wav

# 2. Громкость всего фильма (EBU R128) и паузы.
ffmpeg -hide_banner -nostdin -i audio_full.wav -af ebur128=peak=true -f null - 2>&1 | tail -20 > loudness.txt
ffmpeg -hide_banner -nostdin -i audio_full.wav -af "silencedetect=n=-50dB:d=0.4" -f null - 2>&1 \
  | grep -E "silence_(start|end)" | sed 's/.*silence_/silence_/' > silence.txt || true

# 3. Расшифровка в фоне. Без опоры на предыдущий текст: иначе модель
#    зацикливается на музыке и теряет речь после неё.
( mlx_whisper audio16k.wav --model mlx-community/whisper-large-v3-turbo --language "$LANGUAGE" \
    --word-timestamps True --condition-on-previous-text False --hallucination-silence-threshold 2 \
    ${PROMPT:+--initial-prompt "$PROMPT"} --output-format all --output-dir tr > whisper.log 2>&1 ) &
WHISPER_PID=$!
trap 'kill "$WHISPER_PID" 2>/dev/null' EXIT

# 4. Один проход по видео: кадры через шаг, склейки, чёрные и застывшие кадры.
ffmpeg -hide_banner -nostdin -y -loglevel error -hwaccel videotoolbox -i "$VIDEO" -an \
  -filter_complex "[0:v]scale=320:180,split=3[a][b][c];[a]select='gt(scene,0.2)',metadata=print:file=scenes.txt[s];[b]fps=1/${STEP}[t];[c]blackdetect=d=0.3:pix_th=0.10,freezedetect=n=0.003:d=2,metadata=print:file=freeze.txt[f]" \
  -map "[s]" -f null - -map "[t]" -q:v 4 frames/t_%04d.jpg -map "[f]" -f null -

# 5. Листы-миниатюры с таймкодами.
uv run -q --with pillow "$HERE/contact_sheets.py" frames sheets --step "$STEP" > sheets/index.txt

wait "$WHISPER_PID"
trap - EXIT
echo "готово: $WORK"
