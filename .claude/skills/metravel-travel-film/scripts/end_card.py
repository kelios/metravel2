#!/usr/bin/env python3
"""Традиционная концовка MeTravel (как в фильме о Португальском пути): чёрный экран, «metravel.by» в белой уголковой рамке,
через 0,6 с — год над рамкой. end_card.py <out.mp4> <год> [длина с]. Вызывает film_serial.end_card().
Шрифты: FILM_FONT_END_BOLD / FILM_FONT_END (film.json → "fonts": {"end_bold", "end"}), иначе Open Sans Bold и Regular из загрузок
Filmora, иначе системные Open Sans или Arial."""
import sys, subprocess, os
from PIL import Image, ImageDraw, ImageFont
out, year = sys.argv[1], sys.argv[2]; dur = float(sys.argv[3]) if len(sys.argv) > 3 else 5.0
SYS = "/System/Library/Fonts/Supplemental/"
FD = os.path.expanduser("~/Library/Application Support/Wondershare Filmora Mac/ProgramData/Download/Filmora/title/1_Title_39/Font/")


def _font(env, *paths):
    for p in (os.environ.get(env),) + paths:
        if p and os.path.exists(p): return p
    raise SystemExit(f"шрифт концовки не найден: задай {env} или film.json → fonts")


FB = _font("FILM_FONT_END_BOLD", FD + "OpenSans-Bold.ttf", SYS + "OpenSans-Bold.ttf", SYS + "Arial Bold.ttf")
FR = _font("FILM_FONT_END", FD + "OpenSans-Regular.ttf", SYS + "OpenSans-Regular.ttf", SYS + "Arial.ttf")
W, H = 3840, 2160; S = W / 854                                # эталон снят с кадра 854x480
def layer(with_year):
    im = Image.new("RGB", (W, H), (0, 0, 0)); d = ImageDraw.Draw(im)
    fb = ImageFont.truetype(FB, int(38 * S)); fr = ImageFont.truetype(FR, int(22 * S))
    txt = "MeTravel.by"; x0, y0 = 334 * S, 218 * S; sp = 9.0 * S
    x = x0
    for ch in txt:
        d.text((x, y0), ch, font=fb, fill=(255, 255, 255)); x += d.textlength(ch, font=fb) + sp
    lw = int(2.6 * S)
    d.line([(312 * S, 204 * S), (350 * S, 204 * S)], fill=(255, 255, 255), width=lw)      # верх рамки
    d.line([(312 * S, 204 * S), (312 * S, 281 * S)], fill=(255, 255, 255), width=lw)      # лево
    d.line([(312 * S, 281 * S), (440 * S, 281 * S)], fill=(255, 255, 255), width=lw)      # низ
    if with_year:
        x = 374 * S
        for ch in year:
            d.text((x, 186 * S), ch, font=fr, fill=(255, 255, 255)); x += d.textlength(ch, font=fr) + 3.0 * S
    return im
tmp = os.path.splitext(out)[0]
layer(False).save(tmp + "_a.png"); layer(True).save(tmp + "_b.png")
fc = ("[0:v]format=yuv420p,fade=t=in:st=0:d=0.6[a];[1:v]format=yuv420p[b];[a][b]xfade=transition=fade:duration=0.5:offset=0.7,"
      f"fade=t=out:st={dur - 0.8:.2f}:d=0.8,fps=30000/1001[v]")
subprocess.run(["ffmpeg", "-v", "error", "-y", "-loop", "1", "-t", "1.2", "-i", tmp + "_a.png", "-loop", "1", "-t", f"{dur - 0.7:.2f}", "-i", tmp + "_b.png",
                "-f", "lavfi", "-t", f"{dur:.2f}", "-i", "anullsrc=r=48000:cl=stereo", "-filter_complex", fc, "-map", "[v]", "-map", "2:a",
                "-c:v", "h264_videotoolbox", "-b:v", "20M", "-c:a", "aac", "-t", f"{dur:.2f}", out], check=True, stdin=subprocess.DEVNULL)
os.remove(tmp + "_a.png"); os.remove(tmp + "_b.png"); print(out)
