#!/usr/bin/env python3
"""Технический контроль готового файла перед YouTube: один проход декодирования, вердикт по каждому пункту.

python3 audit_tech.py <фильм.mp4> [--out audit_tech.md] [--quick] [--end-card 6]

Пункты (❌ — блокер, ⚠ — посмотреть):
  контейнер   moov в начале файла (faststart), видео и звук одной длины (±0,1 с)
  видео       H.264/HEVC, yuv420p, постоянная частота кадров, метки цвета bt709 (без них YouTube гадает и цвет «плывёт»),
              разрешение и битрейт по рекомендации YouTube (4K30 SDR ≥ 35 Мбит/с, 1080p30 ≥ 8 Мбит/с)
  звук        AAC 48 кГц стерео ≥ 256 кбит/с; −14 ±1 LUFS; истинный пик ≤ −1 dBTP; LRA ≤ 15 LU;
              клиппинг (сэмплы на полной шкале), постоянная составляющая, противофаза каналов (фаза < −0,2 дольше 1 с),
              тишина дольше 2 с (кроме последних --end-card секунд)
  картинка    ошибки декодирования, чёрные кадры дольше 0,5 с (кроме начала и концовки), застывшая картинка дольше 6 с
--quick пропускает полный проход (только метаданные и громкость звука) — для черновиков.
Рядом с --out пишется .json с теми же пунктами.
"""
import json, os, re, subprocess, sys, tempfile

a = sys.argv[1:]
film = a[0]
opt = lambda k, d=None: a[a.index(k) + 1] if k in a else d
out = opt("--out"); quick = "--quick" in a; END = float(opt("--end-card", "6"))
R = []   # (статус, пункт, подробности)
add = lambda ok, name, det, warn=False: R.append(("✅" if ok else ("⚠" if warn else "❌"), name, det))

pr = json.loads(subprocess.run(["ffprobe", "-v", "error", "-show_streams", "-show_format", "-of", "json", film],
                               capture_output=True, text=True).stdout)
V = next((s for s in pr["streams"] if s["codec_type"] == "video"), {}); A = next((s for s in pr["streams"] if s["codec_type"] == "audio"), {})
dur = float(pr["format"]["duration"])
fr = lambda x: (lambda n, d: float(n) / float(d) if float(d) else 0)(*x.split("/"))

# контейнер: порядок верхних атомов
def top_atoms(p):
    names, off, size = [], 0, os.path.getsize(p)
    with open(p, "rb") as f:
        while off < size and len(names) < 20:
            f.seek(off); h = f.read(16)
            if len(h) < 8: break
            n = int.from_bytes(h[:4], "big"); t = h[4:8].decode("latin1")
            if n == 1: n = int.from_bytes(h[8:16], "big")
            if n < 8: break
            names.append(t); off += n
    return names
at = top_atoms(film)
add("moov" in at and "mdat" in at and at.index("moov") < at.index("mdat"), "faststart (moov до mdat)", " → ".join(at[:6]))
vd, ad = float(V.get("duration", dur)), float(A.get("duration", dur))
add(abs(vd - ad) <= 0.1, "длины видео и звука", f"видео {vd:.2f} с, звук {ad:.2f} с")

# видео
w, h = int(V.get("width", 0)), int(V.get("height", 0))
add(V.get("codec_name") in ("h264", "hevc"), "видеокодек", f"{V.get('codec_name')} {V.get('profile', '')}")
add(V.get("pix_fmt") in ("yuv420p", "yuvj420p", "yuv420p10le"), "формат пикселей", V.get("pix_fmt", "?"))
rf, af = fr(V.get("r_frame_rate", "0/1")), fr(V.get("avg_frame_rate", "0/1"))
add(abs(rf - af) < 0.01, "постоянная частота кадров", f"r {rf:.3f}, avg {af:.3f}")
tags = (V.get("color_primaries"), V.get("color_transfer"), V.get("color_space"))
add(all(t == "bt709" for t in tags), "метки цвета bt709", f"primaries/transfer/matrix = {tags}", warn=True)
vb = int(V.get("bit_rate") or pr["format"].get("bit_rate") or 0) / 1e6
need = 35 if h >= 2160 else 16 if h >= 1440 else 8 if h >= 1080 else 5
add(vb >= need, "битрейт видео", f"{w}×{h}, {vb:.1f} Мбит/с (YouTube рекомендует ≥ {need})", warn=True)

# звук: метаданные
add(A.get("codec_name") == "aac" and A.get("sample_rate") == "48000" and int(A.get("channels", 0)) == 2,
    "звук AAC 48 кГц стерео", f"{A.get('codec_name')} {A.get('sample_rate')} Гц, каналов {A.get('channels')}")
ab = int(A.get("bit_rate") or 0) / 1000
add(ab >= 256, "битрейт звука", f"{ab:.0f} кбит/с", warn=True)

# один проход: громкость/пик/LRA, astats, фаза, тишина; без --quick — ещё полное декодирование картинки с чёрными и застывшими
T = tempfile.mkdtemp()
afc = (f"[0:a]asplit=2[a1][a2];[a1]ebur128=peak=true:framelog=quiet,"
       f"astats=metadata=1:reset=0:measure_overall=Peak_level+Peak_count+DC_offset+Number_of_samples:measure_perchannel=none,"
       f"silencedetect=n=-50dB:d=2[ao];"                       # у графа должен быть выход: звук идёт в null-вывод
       f"[a2]aphasemeter=video=0,ametadata=print:key=lavfi.aphasemeter.phase:file={T}/phase.txt,anullsink")
# level+info: [error]/[info] в начале строки — ошибки декодирования отличимы от текста метаданных
cmd = ["ffmpeg", "-hide_banner", "-nostdin", "-loglevel", "level+info"] + ([] if quick else ["-hwaccel", "videotoolbox"]) + ["-i", film]
if not quick:
    fc = afc + (f";[0:v]scale=480:270,blackdetect=d=0.5:pix_th=0.10,freezedetect=n=0.003:d=6,"
                f"metadata=print:file={T}/v.txt[vo]")
    cmd += ["-filter_complex", fc, "-map", "[vo]", "-map", "[ao]", "-f", "null", "-"]
else:
    cmd += ["-filter_complex", afc, "-map", "[ao]", "-f", "null", "-"]
r = subprocess.run(cmd, capture_output=True, text=True)
log = r.stderr
m = re.findall(r"I:\s+(-?[\d.]+) LUFS", log); I = float(m[-1]) if m else None
m = re.findall(r"LRA:\s+([\d.]+) LU", log); LRA = float(m[-1]) if m else None
m = re.findall(r"Peak:\s+(-?[\d.]+|-inf) dBFS", log); TP = float(m[-1]) if m and m[-1] != "-inf" else None
add(I is not None and -15 <= I <= -13, "громкость −14 LUFS", f"I = {I} LUFS")
add(TP is not None and TP <= -1.0, "истинный пик ≤ −1 dBTP", f"{TP} dBTP")
add(LRA is not None and LRA <= 15, "диапазон громкости LRA", f"{LRA} LU", warn=True)
pk = re.findall(r"Peak level dB:\s*(-?[\d.]+|-inf)", log); pc = re.findall(r"Peak count:\s*([\d.]+)", log)
dc = re.findall(r"DC offset:\s*(-?[\d.]+)", log)
clip = pk and pk[-1] != "-inf" and float(pk[-1]) >= -0.1 and pc and float(pc[-1]) > 10
add(not clip, "клиппинг", f"пик по сэмплам {pk[-1] if pk else '?'} дБ, сэмплов на пике {pc[-1] if pc else '?'}")
add(not dc or abs(float(dc[-1])) < 0.005, "постоянная составляющая", f"DC {dc[-1] if dc else '?'}", warn=True)
ph = []
if os.path.exists(f"{T}/phase.txt"):
    tt = None
    for line in open(f"{T}/phase.txt"):
        mm = re.search(r"pts_time:([\d.]+)", line)
        if mm: tt = float(mm.group(1)); continue
        mm = re.search(r"phase=(-?[\d.]+)", line)
        if mm and tt is not None: ph.append((tt, float(mm.group(1))))
neg, run0, runs = 0.0, None, []
for i in range(1, len(ph)):
    if ph[i][1] < -0.2:
        run0 = ph[i - 1][0] if run0 is None else run0
    elif run0 is not None:
        if ph[i][0] - run0 > 1: runs.append((run0, ph[i][0]))
        run0 = None
if run0 is not None and ph[-1][0] - run0 > 1: runs.append((run0, ph[-1][0]))   # противофаза до конца файла
tc = lambda x: f"{int(x // 60)}:{x % 60:04.1f}"
add(not runs, "противофаза каналов", "нет" if not runs else "; ".join(f"{tc(x)}–{tc(y)}" for x, y in runs[:8]), warn=True)
sil = [(float(s), float(d)) for s, d in zip(re.findall(r"silence_start: ([\d.]+)", log), re.findall(r"silence_duration: ([\d.]+)", log))]
sil = [(s, d) for s, d in sil if s < dur - END]
add(not sil, "тишина дольше 2 с", "нет" if not sil else "; ".join(f"{tc(s)} ({d:.1f} с)" for s, d in sil[:10]))

if not quick:
    # строка ошибки: «[h264 @ 0x…] [error] …» — уровень идёт после контекста, если он есть
    errs = [l for l in log.splitlines() if re.match(r"(\[[^\]]* @ [^\]]*\] )?\[(error|fatal|panic)\] ", l)]
    add(r.returncode == 0 and not errs, "декодирование целиком", f"код {r.returncode}, строк с ошибками {len(errs)}" + (f": {errs[0][:120]}" if errs else ""))
    vt = open(f"{T}/v.txt").read() if os.path.exists(f"{T}/v.txt") else ""
    bs = [float(x) for x in re.findall(r"black_start=([\d.]+)", vt)]; be = [float(x) for x in re.findall(r"black_end=([\d.]+)", vt)]
    blk = [(s, e) for s, e in zip(bs, be + [dur]) if 1.0 < s < dur - END]   # чёрное до конца файла — тоже находка
    add(not blk, "чёрные кадры", "нет" if not blk else "; ".join(f"{tc(s)} ({e - s:.1f} с)" for s, e in blk[:10]))
    fs = [float(x) for x in re.findall(r"freeze_start=([\d.]+)", vt)]; fd = [float(x) for x in re.findall(r"freeze_duration=([\d.]+)", vt)]
    fd += [dur - s for s in fs[len(fd):]]                    # застывшее до конца файла: freeze_duration не печатается
    fz = [(s, d) for s, d in zip(fs, fd) if s < dur - END]
    add(not fz, "застывшая картинка > 6 с", "нет" if not fz else "; ".join(f"{tc(s)} ({d:.1f} с)" for s, d in fz[:10]), warn=True)

bad = [x for x in R if x[0] == "❌"]; warn = [x for x in R if x[0] == "⚠"]
lines = [f"# Техконтроль: {os.path.basename(film)} — {'ГОДЕН' if not bad else 'НЕ ГОДЕН'}"
         + (f", замечаний {len(warn)}" if warn else ""), "",
         f"Длительность {tc(dur)}, {w}×{h}, {os.path.getsize(film) / 1e9:.2f} ГБ" + (" (быстрая проверка без декодирования картинки)" if quick else ""), "",
         "| | пункт | значение |", "| --- | --- | --- |"] + [f"| {s} | {n} | {d} |" for s, n, d in R]
txt = "\n".join(lines)
if out:
    open(out, "w").write(txt)
    json.dump([{"status": s, "check": n, "detail": d} for s, n, d in R], open(os.path.splitext(out)[0] + ".json", "w"), ensure_ascii=False, indent=1)
print(txt)
sys.exit(1 if bad else 0)
