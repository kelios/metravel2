#!/usr/bin/env python3
"""Перебивки «воспоминания»: memory_grade.py <memory_jobs.json> — задания пишет film_serial.memory_look().
Каждая задача — кусок исходника (с запасом 1 с) → 3840x2160, 29.97, приглушённый тёплый цвет, мягкая виньетка,
лёгкое зерно, без звука (H.264 50 Мбит/с). Вертикальные — по центру на размытом фоне. Готовые файлы пропускаются.
Файла заданий нет или все копии готовы — выход без очереди тяжёлых заданий (шаг "after_plan" в film.json)."""
import json, os, subprocess, sys, concurrent.futures as cf

_HWK = {}
def _hw(path):
    """Аппаратный декодер Mac — только для HEVC 4:2:0 и H.264 4:2:0 8 бит: там кадры бит в бит и в 5–7 раз быстрее.
    H.264 4:2:2 10 бит (ZV-E1, папки zv-e1) VideoToolbox портит и теряет кадры без кода ошибки (замер 22.11) — программно."""
    if path not in _HWK:
        r = subprocess.run(["ffprobe", "-v", "error", "-select_streams", "v:0", "-show_entries", "stream=codec_name,pix_fmt", "-of", "csv=p=0", path],
                           capture_output=True, text=True).stdout.strip().split("\n")[0].strip(",").split(",")
        _HWK[path] = len(r) >= 2 and ((r[0] == "hevc" and r[1] in ("yuv420p", "yuvj420p", "yuv420p10le")) or (r[0] == "h264" and r[1] in ("yuv420p", "yuvj420p")))
    return ["-hwaccel", "videotoolbox"] if _HWK[path] else []

if len(sys.argv) < 2: sys.exit(__doc__)
if not os.path.exists(sys.argv[1]): print("memory_grade: заданий нет —", sys.argv[1]); sys.exit(0)
jobs = json.load(open(sys.argv[1]))
W, H = 3840, 2160
LOOK = "eq=saturation=0.5:contrast=0.92:brightness=0.03:gamma=1.04,colorbalance=rs=0.09:gs=0.03:bs=-0.09:rm=0.06:gm=0.02:bm=-0.07:rh=0.04:bh=-0.05,gblur=sigma=0.7,vignette=angle=PI/4.2,noise=alls=7:allf=t,format=yuv420p"  # v4: заметнее


def run(j):
    out = j["out"]
    if os.path.exists(out):
        return "есть"
    os.makedirs(os.path.dirname(out), exist_ok=True)
    look = LOOK
    if j.get("dip_at") is not None:   # белая вспышка на входе: 0,35 с из белого
        look = LOOK + f",fade=t=in:st={j['dip_at']:.3f}:d=0.35:color=white"
    if j.get("fit") == "contain":
        fc = (f"[0:v]split[a][b];[a]scale={W}:{H}:force_original_aspect_ratio=increase,crop={W}:{H},boxblur=40:2,eq=brightness=-0.08[bg];"
              f"[b]scale=-2:{H}[fg];[bg][fg]overlay=(W-w)/2:0,fps=30000/1001,{look}[v]")
    else:                                     # вертикальное в «cover»: полоса по людям (crop_band, рецензент 23.11), без людей — по центру
        y = BAND.get(crop_band._key(j["src"], float(j["in"]), float(j["dur"])))
        cy = f"'max(0,min(ih-oh,ih*{y:.4f}-oh/2))'" if y is not None else "(ih-oh)/2"
        fc = f"[0:v]scale={W}:{H}:force_original_aspect_ratio=increase,crop={W}:{H}:(iw-ow)/2:{cy},fps=30000/1001,{look}[v]"
    r = subprocess.run(["ffmpeg", "-v", "error", "-y"] + _hw(j["src"]) + ["-ss", f"{j['in']:.3f}", "-t", f"{j['dur']:.3f}", "-i", j["src"],
                        "-filter_complex", fc, "-map", "[v]", "-an", "-c:v", "h264_videotoolbox", "-b:v", "50M",
                        "-color_primaries", "bt709", "-color_trc", "bt709", "-colorspace", "bt709", out + ".part.mp4"],
                       stdin=subprocess.DEVNULL, capture_output=True, text=True)
    if r.returncode != 0:
        return "ОШИБКА " + r.stderr[-300:]
    os.replace(out + ".part.mp4", out)
    return "ok"


sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import crop_band, heavy_lock
if all(os.path.exists(j["out"]) for j in jobs): print(f"memory_grade: все копии готовы ({len(jobs)})"); sys.exit(0)
heavy_lock.acquire(f"memory_grade {os.path.basename(sys.argv[1])}", wait="--no-wait" not in sys.argv)   # тяжёлое задание: рендер первым
def _tall(p):
    r = json.loads(subprocess.run(["ffprobe", "-v", "error", "-select_streams", "v:0", "-show_entries", "stream=width,height:stream_side_data=rotation",
                                   "-of", "json", p], capture_output=True, text=True).stdout or "{}").get("streams") or [{}]
    w, h = r[0].get("width", 16), r[0].get("height", 9)
    if abs(int(float((r[0].get("side_data_list") or [{}])[0].get("rotation", 0) or 0))) in (90, 270): w, h = h, w
    return h / max(1, w) > (H / W) * 1.02
_need = [(j["src"], float(j["in"]), float(j["dur"])) for j in jobs if not os.path.exists(j["out"]) and j.get("fit") != "contain"
         and os.path.exists(j["src"]) and _tall(j["src"])]
BAND = crop_band.ensure(_need, crop_band.find_yolox(os.path.dirname(os.path.abspath(sys.argv[1])), os.getcwd())) if _need else {}
with cf.ThreadPoolExecutor(3) as ex:
    for j, res in zip(jobs, ex.map(run, jobs)):
        print(res, os.path.basename(j["src"]), round(j["dur"], 1), flush=True)
