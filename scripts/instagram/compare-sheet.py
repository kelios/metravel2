#!/usr/bin/env python3
"""Лист «было → станет» для владельца перед заменой записи в расписании (правило владельца 26.10.2026:
«показывай мне всегда, что на что ты хочешь переделывать»; docs/INSTAGRAM_OPERATIONS.md §1).

Запуск: python3 scripts/instagram/compare-sheet.py <было> <станет> <out.jpg> [--caption-old F] [--caption-new F]
<было> и <станет> — папка со слайдами (*.jpg/*.png, по имени) или пакет (берётся его slides/).
Верхний ряд — «Было» (то, что стоит в расписании), нижний — «Станет»; под рядами — первые строки подписей.
Нужен Pillow.
"""
import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

FONT = "/System/Library/Fonts/Supplemental/PTSans.ttc"
TW, TH, GAP, PAD, LABEL = 300, 375, 12, 24, 54


def font(size, bold=False):
    return ImageFont.truetype(FONT, size, index=7 if bold else 0)


def slides(src):
    path = Path(src)
    if (path / "slides").is_dir():
        path = path / "slides"
    files = sorted(p for p in path.iterdir() if p.suffix.lower() in (".jpg", ".jpeg", ".png") and not p.name.startswith("."))
    # .png и .jpg одного слайда — берём один
    seen, out = set(), []
    for p in files:
        if p.stem not in seen:
            seen.add(p.stem)
            out.append(p)
    if not out:
        raise SystemExit(f"compare-sheet: нет слайдов в {src}")
    return out


def first_lines(path, n=2, width=150):
    if not path:
        return ""
    text = Path(path).read_text(encoding="utf-8").strip().splitlines()
    return " / ".join(line for line in text[:n] if line.strip())[:width]


def main(argv):
    args, opts, i = [], {}, 0
    while i < len(argv):
        if argv[i].startswith("--"):
            opts[argv[i]] = argv[i + 1] if i + 1 < len(argv) else ""
            i += 2
        else:
            args.append(argv[i])
            i += 1
    if len(args) < 3:
        raise SystemExit(__doc__)
    old, new, out = slides(args[0]), slides(args[1]), Path(args[2])
    cols = max(len(old), len(new))
    width = PAD * 2 + cols * TW + (cols - 1) * GAP
    height = PAD * 2 + 2 * (LABEL + TH) + GAP * 3 + 2 * 40
    sheet = Image.new("RGB", (width, height), (246, 245, 241))
    draw = ImageDraw.Draw(sheet)
    y = PAD
    for title, files, cap in (("Было — стоит в расписании", old, opts.get("--caption-old")),
                              ("Станет — после замены", new, opts.get("--caption-new"))):
        draw.text((PAD, y + 8), f"{title} · {len(files)} слайдов", font=font(30, True), fill=(32, 54, 43))
        y += LABEL
        for i, f in enumerate(files):
            im = Image.open(f).convert("RGB").resize((TW, TH), Image.LANCZOS)
            sheet.paste(im, (PAD + i * (TW + GAP), y))
        y += TH + 8
        draw.text((PAD, y), first_lines(cap), font=font(24), fill=(80, 90, 85))
        y += 40 + GAP
    out.parent.mkdir(parents=True, exist_ok=True)
    sheet.save(out, quality=85)
    print(f"compare-sheet: {len(old)} → {len(new)} слайдов, {out}")


if __name__ == "__main__":
    main(sys.argv[1:])
