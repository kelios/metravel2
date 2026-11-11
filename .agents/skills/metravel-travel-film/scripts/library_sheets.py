#!/usr/bin/env python3
"""Листы-миниатюры по папке исходников: один кадр на файл, подпись — номер и длительность.

Запуск: uv run --with pillow --with pillow-heif library_sheets.py <папка исходников> <out_dir> [--cols 8] [--rows 6]
Нужен для подбора перебивок. Исходники только читаются.
Номер берётся из имени «Медиатека - 321 из 2511.mov»; иначе подписывается начало имени.
"""
import argparse
import os
import re
import subprocess
import tempfile

from PIL import Image, ImageDraw, ImageFont, ImageOps

try:
    from pillow_heif import register_heif_opener

    register_heif_opener()
except ImportError:
    pass

VIDEO = {".mov", ".mp4", ".m4v"}
PHOTO = {".jpg", ".jpeg", ".png", ".heic"}
W, H = 240, 135


def key(name: str):
    m = re.search(r"(\d+)\s+из\s+\d+", name)
    return (0, int(m.group(1))) if m else (1, name)


def label(name: str) -> str:
    m = re.search(r"(\d+)\s+из\s+\d+", name)
    return m.group(1) if m else os.path.splitext(name)[0][:10]


def duration(path: str) -> float:
    r = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", path],
                       capture_output=True, text=True)
    try:
        return float(r.stdout.strip())
    except ValueError:
        return 0.0


def thumb(path: str, tmp: str) -> Image.Image | None:
    ext = os.path.splitext(path)[1].lower()
    try:
        if ext in VIDEO:
            out = os.path.join(tmp, "f.jpg")
            subprocess.run(["ffmpeg", "-nostdin", "-y", "-loglevel", "error", "-ss", "1", "-i", path,
                            "-frames:v", "1", "-vf", f"scale={W}:-2,format=yuvj420p", out], check=True)
            img = Image.open(out).convert("RGB")
        else:
            img = ImageOps.exif_transpose(Image.open(path)).convert("RGB")
        return ImageOps.pad(img, (W, H), color="black")
    except Exception:
        return None


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("src")
    ap.add_argument("out_dir")
    ap.add_argument("--cols", type=int, default=8)
    ap.add_argument("--rows", type=int, default=6)
    args = ap.parse_args()

    names = sorted((n for n in os.listdir(args.src)
                    if not n.startswith(".") and os.path.splitext(n)[1].lower() in VIDEO | PHOTO), key=key)
    os.makedirs(args.out_dir, exist_ok=True)
    try:
        font = ImageFont.truetype("/System/Library/Fonts/Helvetica.ttc", 14)
    except OSError:
        font = ImageFont.load_default()
    per = args.cols * args.rows
    with tempfile.TemporaryDirectory() as tmp:
        for page, i in enumerate(range(0, len(names), per)):
            chunk = names[i:i + per]
            sheet = Image.new("RGB", (args.cols * W, args.rows * H), "black")
            draw = ImageDraw.Draw(sheet)
            for j, n in enumerate(chunk):
                path = os.path.join(args.src, n)
                x, y = (j % args.cols) * W, (j // args.cols) * H
                img = thumb(path, tmp)
                if img:
                    sheet.paste(img, (x, y))
                is_video = os.path.splitext(n)[1].lower() in VIDEO
                text = f"{label(n)} {duration(path):.0f}s" if is_video else f"{label(n)} фото"
                draw.rectangle([x, y, x + 8 * len(text) + 6, y + 18], fill="black")
                draw.text((x + 3, y + 2), text, fill="yellow" if is_video else "white", font=font)
            name = f"lib_{page + 1:02d}.jpg"
            sheet.save(os.path.join(args.out_dir, name), quality=80)
            print(name, label(chunk[0]), "-", label(chunk[-1]))


if __name__ == "__main__":
    main()
