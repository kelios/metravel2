#!/usr/bin/env python3
"""Собирает вертикальный ролик 1080x1920 для Instagram Reels из фото и текста.

Вход — JSON-спецификация:
  {
    "out": ".codex-temp/instagram/reels/2026-10-06-gr21.mp4",
    "cover_text": "GR21 · Нормандия · сколько стоит",
    "segments": [
      {"text": "GR21, Нормандия: 100 км...", "duration": 3, "images": ["https://...webp"]},
      ...
    ]
  }

Источник в `images` — фото (локальный путь или URL) либо видеоклип (.mov/.mp4), только
свои материалы автора 1. Клип можно задать объектом {"src": "...", "start": 4.5}; без
`start` берётся кусок с первой трети клипа. Каждый источник сегмента показывается равную
долю его длительности: альбомное фото — панорамой слева направо, портретное — медленным
наездом, видео — как снято, с обрезкой до 9:16.

Звук: по умолчанию остаётся родной звук клипов (`"sound": "natural"`; `"none"` — тишина).
`"music": "путь.mp3"` подмешивает трек под родной звук (`"music_volume"`, по умолчанию 0.25)
с затуханием в конце. Трек — только тот, на который есть права (своя запись или библиотека
со свободной лицензией); музыку из каталога Instagram в файл вставить нельзя. Текст рисует Pillow (в сборке ffmpeg нет drawtext).

Запуск: python3 scripts/instagram/make-reel.py spec.json
Нужны ffmpeg и Pillow.
"""
import json
import subprocess
import sys
import tempfile
import urllib.request
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont, ImageOps

W, H, FPS = 1080, 1920, 30
VIDEO_SUFFIXES = {".mov", ".mp4", ".m4v"}
# Одинаковые параметры кодирования у всех кусков — иначе склейка без перекодирования рвётся.
ENCODE = [
    "-r", str(FPS), "-c:v", "libx264", "-preset", "medium", "-crf", "22", "-maxrate", "6M", "-bufsize", "12M",
    "-video_track_timescale", "30000", "-an",
]
# Зоны, которые Instagram закрывает своим интерфейсом: шапка сверху, подпись и кнопки снизу.
SAFE_TOP, SAFE_BOTTOM, SIDE = 260, 460, 80
FONT_CANDIDATES = [
    "/System/Library/Fonts/Supplemental/Arial Bold.ttf",
    "/Library/Fonts/Arial Bold.ttf",
    "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
]


def load_font(size):
    for path in FONT_CANDIDATES:
        if Path(path).exists():
            return ImageFont.truetype(path, size)
    raise SystemExit("make-reel: не найден шрифт с кириллицей (см. FONT_CANDIDATES)")


def wrap(draw, text, font, max_width):
    lines, line = [], ""
    for word in text.split():
        probe = f"{line} {word}".strip()
        if draw.textlength(probe, font=font) <= max_width or not line:
            line = probe
        else:
            lines.append(line)
            line = word
    if line:
        lines.append(line)
    return lines


def text_overlay(text, path, size=64, anchor="bottom"):
    """Прозрачный PNG 1080x1920 с плашкой и текстом внутри безопасной зоны."""
    img = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    font = load_font(size)
    pad, gap = 36, 16
    max_width = W - 2 * SIDE - 2 * pad
    lines = wrap(draw, text, font, max_width)
    # Выравниваем строки по длине: сужаем блок, пока число строк не растёт, — без висячих слов.
    for width in range(int(max_width) - 40, 400, -40):
        narrower = wrap(draw, text, font, width)
        if len(narrower) > len(lines):
            break
        lines = narrower
    line_h = font.getbbox("Ау")[3] + gap
    box_h = line_h * len(lines) + 2 * pad - gap
    box_w = max(draw.textlength(line, font=font) for line in lines) + 2 * pad
    x0 = (W - box_w) / 2
    y0 = SAFE_TOP if anchor == "top" else H - SAFE_BOTTOM - box_h
    draw.rounded_rectangle([x0, y0, x0 + box_w, y0 + box_h], radius=28, fill=(0, 0, 0, 165))
    for i, line in enumerate(lines):
        lw = draw.textlength(line, font=font)
        draw.text(((W - lw) / 2, y0 + pad + i * line_h), line, font=font, fill=(255, 255, 255, 255))
    img.save(path)


def fetch_image(src, path):
    """Скачивает или читает фото, применяет EXIF-поворот, сохраняет JPEG."""
    if src.startswith("http"):
        raw = Path(str(path) + ".src")
        request = urllib.request.Request(src, headers={"User-Agent": "metravel-reel/1.0"})
        with urllib.request.urlopen(request, timeout=60) as response:
            raw.write_bytes(response.read())
        src = raw
    img = ImageOps.exif_transpose(Image.open(src)).convert("RGB")
    img.save(path, quality=92)
    return img.size


def clip(image, size, overlay, duration, out):
    """Один кадр-клип: панорама для альбомного фото, наезд для портретного."""
    iw, ih = size
    if iw / ih > W / H * 1.15:
        motion = f"scale=-2:{H},crop={W}:{H}:x='(iw-{W})*t/{duration}':y=0"
    else:
        frames = int(duration * FPS)
        motion = (
            f"scale={W * 2}:{H * 2}:force_original_aspect_ratio=increase,crop={W * 2}:{H * 2},"
            f"zoompan=z='1+0.10*on/{frames}':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':"
            f"d={frames}:s={W}x{H}:fps={FPS}"
        )
    subprocess.run(
        [
            "ffmpeg", "-y", "-loglevel", "error", "-loop", "1", "-framerate", str(FPS), "-i", str(image),
            "-i", str(overlay), "-filter_complex", f"[0:v]{motion},setsar=1[bg];[bg][1:v]overlay=0:0,format=yuv420p",
            "-t", f"{duration:.3f}", *ENCODE, str(out),
        ],
        check=True,
    )


def video_clip(src, start, overlay, duration, out):
    """Кусок видеоклипа: обрезка до 9:16, 30 кадров в секунду, без звука."""
    if start is None:
        probe = subprocess.run(
            ["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", str(src)],
            check=True, capture_output=True, text=True,
        )
        start = max(0.0, min(float(probe.stdout.strip()) / 3, float(probe.stdout.strip()) - duration))
    subprocess.run(
        [
            "ffmpeg", "-y", "-loglevel", "error", "-ss", f"{start:.3f}", "-i", str(src), "-i", str(overlay),
            "-filter_complex",
            f"[0:v]scale={W}:{H}:force_original_aspect_ratio=increase,crop={W}:{H},fps={FPS},setsar=1[bg];"
            "[bg][1:v]overlay=0:0,format=yuv420p",
            "-t", f"{duration:.3f}", *ENCODE, str(out),
        ],
        check=True,
    )
    return start


# Родной звук с телефона на природе очень тихий (в среднем около -50 дБ) — подтягиваем до слышимого.
LEVEL = "loudnorm=I=-26:TP=-2:LRA=11,aresample=48000"


def audio_part(src, start, duration, out):
    """Звуковая дорожка одного куска: родной звук клипа или тишина для фото."""
    has_audio = False
    if src is not None:
        probe = subprocess.run(
            ["ffprobe", "-v", "error", "-select_streams", "a:0", "-show_entries", "stream=codec_name",
             "-of", "csv=p=0", str(src)],
            capture_output=True, text=True,
        )
        has_audio = bool(probe.stdout.strip())
    if has_audio:
        fade_out = max(0.0, duration - 0.08)
        source = ["-ss", f"{start:.3f}", "-t", f"{duration:.3f}", "-i", str(src), "-vn", "-af",
                  f"aresample=48000,aformat=channel_layouts=stereo,apad,atrim=0:{duration:.3f},"
                  f"afade=t=in:d=0.08,afade=t=out:st={fade_out:.3f}:d=0.08"]
    else:
        source = ["-f", "lavfi", "-t", f"{duration:.3f}", "-i", "anullsrc=r=48000:cl=stereo"]
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", *source, "-c:a", "pcm_s16le", str(out)], check=True)


def mux_audio(video, parts, spec, total, tmp, out):
    """Склеивает звук кусков, подмешивает музыку и сводит с видео без перекодирования картинки."""
    listing = tmp / "audio.txt"
    listing.write_text("".join(f"file '{part}'\n" for part in parts), encoding="utf-8")
    natural = tmp / "natural.wav"
    subprocess.run(
        ["ffmpeg", "-y", "-loglevel", "error", "-f", "concat", "-safe", "0", "-i", str(listing), "-c", "copy", str(natural)],
        check=True,
    )
    command = ["ffmpeg", "-y", "-loglevel", "error", "-i", str(video), "-i", str(natural)]
    music = spec.get("music")
    if music:
        volume = float(spec.get("music_volume", 0.25))
        command += ["-stream_loop", "-1", "-i", str(music), "-filter_complex",
                    f"[1:a]{LEVEL},volume=0.8[n];[2:a]volume={volume},afade=t=out:st={max(0.0, total - 1.5):.3f}:d=1.5[m];"
                    "[n][m]amix=inputs=2:duration=first:normalize=0[a]", "-map", "0:v", "-map", "[a]"]
    else:
        command += ["-map", "0:v", "-map", "1:a", "-af", LEVEL]
    command += ["-c:v", "copy", "-c:a", "aac", "-b:a", "160k", "-t", f"{total:.3f}", "-movflags", "+faststart", str(out)]
    subprocess.run(command, check=True)


def main():
    if len(sys.argv) != 2:
        raise SystemExit(__doc__)
    spec = json.loads(Path(sys.argv[1]).read_text(encoding="utf-8"))
    out = Path(spec["out"])
    out.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory() as tmp:
        tmp = Path(tmp)
        clips, sounds, cover_frame = [], [], None
        natural = spec.get("sound", "natural") == "natural"
        for s, segment in enumerate(spec["segments"]):
            overlay = tmp / f"text{s}.png"
            text_overlay(segment["text"], overlay, size=segment.get("size", 64), anchor=segment.get("anchor", "bottom"))
            share = segment["duration"] / len(segment["images"])
            for i, source in enumerate(segment["images"]):
                src, start = (source["src"], source.get("start")) if isinstance(source, dict) else (source, None)
                clip_path = tmp / f"clip{s}_{i}.mp4"
                if Path(src).suffix.lower() in VIDEO_SUFFIXES:
                    start = video_clip(src, start, overlay, share, clip_path)
                    if cover_frame is None:
                        cover_frame = tmp / "cover_frame.jpg"
                        subprocess.run(
                            ["ffmpeg", "-y", "-loglevel", "error", "-ss", f"{start:.3f}", "-i", str(src),
                             "-frames:v", "1", str(cover_frame)],
                            check=True,
                        )
                else:
                    image = tmp / f"img{s}_{i}.jpg"
                    size = fetch_image(src, image)
                    clip(image, size, overlay, share, clip_path)
                    cover_frame = cover_frame or image
                clips.append(clip_path)
                sound_path = tmp / f"sound{s}_{i}.wav"
                is_video = Path(src).suffix.lower() in VIDEO_SUFFIXES
                audio_part(src if natural and is_video else None, start or 0.0, share, sound_path)
                sounds.append(sound_path)
        listing = tmp / "list.txt"
        listing.write_text("".join(f"file '{c}'\n" for c in clips), encoding="utf-8")
        total = sum(segment["duration"] for segment in spec["segments"])
        with_sound = natural or spec.get("music")
        silent = tmp / "silent.mp4" if with_sound else out
        subprocess.run(
            ["ffmpeg", "-y", "-loglevel", "error", "-f", "concat", "-safe", "0", "-i", str(listing),
             "-c", "copy", "-movflags", "+faststart", str(silent)],
            check=True,
        )
        if with_sound:
            mux_audio(silent, sounds, spec, total, tmp, out)
        if spec.get("cover_text"):
            # Обложка — первый кадр ролика без текста хука, с названием сверху.
            cover = ImageOps.fit(Image.open(cover_frame).convert("RGB"), (W, H))
            cover_overlay = tmp / "cover.png"
            text_overlay(spec["cover_text"], cover_overlay, size=84, anchor="top")
            cover.paste(Image.open(cover_overlay), (0, 0), Image.open(cover_overlay))
            cover.save(out.with_suffix(".cover.jpg"), quality=92)
    total = sum(segment["duration"] for segment in spec["segments"])
    print(f"make-reel: {out} ({total:.0f} с, {len(clips)} кадров)")


if __name__ == "__main__":
    main()
