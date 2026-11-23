#!/usr/bin/env python3
"""Вертикальные куски главной дорожки → 3840x2160 29.97 со звуком (AAC): по умолчанию на размытом фоне, "mode": "crop" — полоса 16:9.
vertical_render.py <vertical_jobs.json> — задания пишет film_serial.vertical_main().
Файла заданий нет или все копии готовы — выход без очереди тяжёлых заданий (шаг "after_plan" в film.json)."""
import json, os, subprocess, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
if len(sys.argv) < 2: sys.exit(__doc__)
if not os.path.exists(sys.argv[1]): print("vertical_render: заданий нет —", sys.argv[1]); sys.exit(0)
JOBS = json.load(open(sys.argv[1]))
if all(os.path.exists(j["out"]) for j in JOBS): print(f"vertical_render: все копии готовы ({len(JOBS)})"); sys.exit(0)
import heavy_lock                      # тяжёлое задание (4K-кодирование): по очереди с рендером, nice 10
heavy_lock.acquire(f"vertical_render {os.path.basename(sys.argv[1])}", wait="--no-wait" not in sys.argv)
W, H = 3840, 2160
for j in JOBS:
    if os.path.exists(j["out"]): continue
    os.makedirs(os.path.dirname(j["out"]), exist_ok=True)
    if j.get("mode") == "crop":       # владелец 22.11: вертикальное — полоса 16:9 по горизонтали (центр на 42 % высоты), без размытого фона
        y = j.get("y", "auto")        # центр полосы — доля высоты кадра (ключ отрезка vcrop_y в плане); "auto" — по людям (crop_band)
        if y == "auto":
            import crop_band
            y = crop_band.ensure([(j["src"], float(j["in"]), float(j["dur"]))], crop_band.find_yolox(os.path.dirname(os.path.abspath(sys.argv[1])), os.getcwd())).get(
                crop_band._key(j["src"], float(j["in"]), float(j["dur"])))
            y = 0.42 if y is None else y  # людей нет — прежние 42 %
        y = float(y)
        fc = f"[0:v]scale={W}:-2,crop={W}:{H}:0:'max(0,min(ih-{H},ih*{y:.3f}-{H // 2}))',fps=30000/1001,format=yuv420p[v]"
    else:
        fc = (f"[0:v]split[a][b];[a]scale={W}:{H}:force_original_aspect_ratio=increase,crop={W}:{H},boxblur=40:2,eq=brightness=-0.08[bg];"
              f"[b]scale=-2:{H}[fg];[bg][fg]overlay=(W-w)/2:0,fps=30000/1001,format=yuv420p[v]")
    r = subprocess.run(["ffmpeg", "-v", "error", "-y", "-ss", f"{j['in']:.3f}", "-t", f"{j['dur']:.3f}", "-i", j["src"], "-filter_complex", fc,
                        "-map", "[v]", "-map", "0:a:0?", "-c:v", "h264_videotoolbox", "-b:v", "45M", "-c:a", "aac", "-b:a", "192k",
                        "-ar", "48000", "-ac", "2", j["out"] + ".part.mp4"], stdin=subprocess.DEVNULL, capture_output=True, text=True)
    if r.returncode: print("ОШИБКА", j["src"], r.stderr[-200:]); continue
    os.replace(j["out"] + ".part.mp4", j["out"]); print("ok", os.path.basename(j["src"]), j["dur"], flush=True)
