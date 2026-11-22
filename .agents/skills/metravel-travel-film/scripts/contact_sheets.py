#!/usr/bin/env python3
"""Собирает листы-миниатюры с таймкодами из кадров, снятых через равный шаг.

Запуск: uv run --with pillow contact_sheets.py <frames_dir> <out_dir> [--step 5] [--cols 6] [--rows 5] [--start N]
Кадры ожидаются как t_0001.jpg, t_0002.jpg ... (ffmpeg fps=1/step), кадр k снят на (k-1)*step секунд.
Печатает по строке на лист: имя файла и диапазон таймкодов.
"""
import argparse
import glob
import os

from PIL import Image, ImageDraw, ImageFont


def tc(sec: float) -> str:
    sec = int(round(sec))
    h, rem = divmod(sec, 3600)
    m, s = divmod(rem, 60)
    return f"{h}:{m:02d}:{s:02d}" if h else f"{m:02d}:{s:02d}"


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("frames_dir")
    ap.add_argument("out_dir")
    ap.add_argument("--step", type=float, default=5.0)
    ap.add_argument("--cols", type=int, default=6)
    ap.add_argument("--rows", type=int, default=5)
    ap.add_argument("--start", type=int, default=1, help="с какого кадра начать (1-based)")
    ap.add_argument("--offset", type=float, default=0.0, help="таймкод первого кадра, с")
    args = ap.parse_args()

    files = sorted(glob.glob(os.path.join(args.frames_dir, "t_*.jpg")))[args.start - 1:]
    if not files:
        raise SystemExit("нет кадров")
    os.makedirs(args.out_dir, exist_ok=True)
    try:
        font = ImageFont.truetype("/System/Library/Fonts/Helvetica.ttc", 15)
    except OSError:
        font = ImageFont.load_default()

    per = args.cols * args.rows
    w, h = Image.open(files[0]).size
    for page, i in enumerate(range(0, len(files), per)):
        chunk = files[i:i + per]
        sheet = Image.new("RGB", (args.cols * w, args.rows * h), "black")
        draw = ImageDraw.Draw(sheet)
        for j, path in enumerate(chunk):
            x, y = (j % args.cols) * w, (j // args.cols) * h
            sheet.paste(Image.open(path).convert("RGB"), (x, y))
            k = args.start - 1 + i + j
            label = tc(args.offset + k * args.step)
            draw.rectangle([x, y, x + 9 * len(label) + 6, y + 19], fill="black")
            draw.text((x + 3, y + 2), label, fill="white", font=font)
        first = args.start - 1 + i
        name = f"sheet_{args.start - 1 + i + 1:04d}.jpg"
        sheet.save(os.path.join(args.out_dir, name), quality=80)
        print(name, tc(args.offset + first * args.step), "-", tc(args.offset + (first + len(chunk) - 1) * args.step))


if __name__ == "__main__":
    main()
