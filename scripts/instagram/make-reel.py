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

Фото — локальный путь или URL (только свои фото автора 1). Каждое фото сегмента
показывается равную долю его длительности: альбомное — панорамой слева направо,
портретное — медленным наездом. Текст рисует Pillow (в сборке ffmpeg нет drawtext).
Музыку добавляет владелец в приложении Instagram при публикации.

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
            "-t", f"{duration:.3f}", "-r", str(FPS), "-c:v", "libx264", "-preset", "medium", "-crf", "19", str(out),
        ],
        check=True,
    )


def main():
    if len(sys.argv) != 2:
        raise SystemExit(__doc__)
    spec = json.loads(Path(sys.argv[1]).read_text(encoding="utf-8"))
    out = Path(spec["out"])
    out.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory() as tmp:
        tmp = Path(tmp)
        clips = []
        for s, segment in enumerate(spec["segments"]):
            overlay = tmp / f"text{s}.png"
            text_overlay(segment["text"], overlay, size=segment.get("size", 64), anchor=segment.get("anchor", "bottom"))
            share = segment["duration"] / len(segment["images"])
            for i, src in enumerate(segment["images"]):
                image = tmp / f"img{s}_{i}.jpg"
                size = fetch_image(src, image)
                clip_path = tmp / f"clip{s}_{i}.mp4"
                clip(image, size, overlay, share, clip_path)
                clips.append(clip_path)
        listing = tmp / "list.txt"
        listing.write_text("".join(f"file '{c}'\n" for c in clips), encoding="utf-8")
        subprocess.run(
            ["ffmpeg", "-y", "-loglevel", "error", "-f", "concat", "-safe", "0", "-i", str(listing),
             "-c", "copy", "-movflags", "+faststart", str(out)],
            check=True,
        )
        if spec.get("cover_text"):
            first = Image.open(tmp / "img0_0.jpg")
            cover = ImageOps.fit(first, (W, H))
            cover_overlay = tmp / "cover.png"
            text_overlay(spec["cover_text"], cover_overlay, size=84, anchor="top")
            cover.paste(Image.open(cover_overlay), (0, 0), Image.open(cover_overlay))
            cover.save(out.with_suffix(".cover.jpg"), quality=92)
    total = sum(segment["duration"] for segment in spec["segments"])
    print(f"make-reel: {out} ({total:.0f} с, {len(clips)} кадров)")


if __name__ == "__main__":
    main()
