#!/usr/bin/env python3
"""Собирает фильм по плану правок: отрезки, перебивки, звук, громкость.

Запуск: python3 assemble_film.py plan.json [--only-audio] [--dry-run]

План (JSON):
{
  "output": "/путь/Фильм — правка 2026-11-11.mp4",
  "workdir": "/временная/папка",
  "video": {"width": 3840, "height": 2160, "fps": 30, "encoder": "h264_videotoolbox", "bitrate": "50M"},
  "audio": {"target_lufs": -14, "true_peak": -1.5, "leveler": 0.6, "highpass": 60},
  "sources": {"film": "/путь/мастер.mp4"},
  "segments": [
    {"src": "film", "in": 0, "out": 452.0, "note": "вступление",
     "afilter": "highpass=f=90", "gain_db": 0, "fade_in": 0, "fade_out": 0,
     "audio_src": "film",
     "broll": [{"at": 460.0, "dur": 6, "file": "/путь/исходник.MOV", "in": 2.0, "fit": "cover",
                "zoom": 0.05, "fade_in": 0.3, "fade_out": 0.3}],
     "cards": [{"at": 213.0, "dur": 5, "file": "/путь/титр.png", "fade": 0.4}]}
  ]
}
"fade_in"/"fade_out" отрезка — затемнение картинки и затухание звука в его начале
и конце. "audio_src" берёт звук отрезка из другого источника с теми же
таймкодами. У перебивки и титра "fade_in"/"fade_out" (или общий "fade") —
плавное появление и исчезновение поверх плана, "fit": "contain" вписывает
кадр с полями вместо обрезки.

Необязательный ключ "remusic" заменяет музыку в сведённом звуке (см. remusic.py):
  "remusic": {
    "words": {"film": {"path": "/путь/tr/audio16k.json", "offset": 0}},
    "jobs": [{"name": "кухня", "src": "film", "old": "/путь/ES_old.mp3",
              "runs": [{"a": 1056.73, "b": 1184.77, "src_in": 0}],
              "new": "/путь/ES_new.mp3", "new_start": 0, "level_db": 0, "lift_db": 4,
              "mute": [[157.27, 163.97]], "solo": [[1280.0, 1313.0]]}]
  }
"mute" — окна, где новая музыка молчит; "solo" — окна, где остаётся только музыка.
Между кусками старого трека новая музыка молчит; "bridge": 3 в задании проводит
её без паузы через промежутки короче трёх секунд.
Времена кусков старого трека берутся из раскладки Filmora в таймкодах источника;
сборщик сам пересчитывает их в таймкоды результата с учётом вырезок, поэтому
новый трек идёт непрерывно поверх склеек. В экспорт кладутся две звуковые
дорожки: первая с новой музыкой, вторая с исходной.

Времена отрезков и перебивок задаются в таймкодах источника (секунды) и
привязываются к сетке кадров. Перебивка закрывает картинку, звук отрезка
продолжается. Фото-перебивка с "zoom": 0.05 получает медленный наезд на 5%.
Звук соседних отрезков сводится кроссфейдом 0,24 с вокруг стыка: вырезка
звучит без щелчка, а смена "gain_db" на непрерывном материале становится
плавной. Перебивку, которая закрывает вырезку, задают двумя записями — в конце
одного отрезка и в начале следующего. Исходники только читаются. Готовые куски кешируются по
содержимому описания, поэтому повторный запуск после правки плана
пересчитывает только изменённые отрезки. Перезапись существующего "output"
запрещена: смени имя файла.
"""
import argparse
import hashlib
import inspect
import json
import os
import subprocess
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
IMAGE_EXT = {".jpg", ".jpeg", ".png"}


def run(cmd: list[str], dry: bool = False) -> None:
    if dry:
        print(" ".join(cmd))
        return
    r = subprocess.run(cmd)
    if r.returncode != 0:
        raise SystemExit(f"команда завершилась с ошибкой {r.returncode}: {' '.join(cmd[:12])} ...")


def snap(t: float, fps: int) -> float:
    return round(t * fps) / fps


def digest(obj) -> str:
    return hashlib.sha1(json.dumps(obj, sort_keys=True, ensure_ascii=False).encode()).hexdigest()[:12]


def source_stamp(path: str) -> list:
    st = os.stat(path)
    return [path, st.st_size, int(st.st_mtime)]


def build_video(seg: dict, src: str, vcfg: dict, out: str, dry: bool) -> None:
    w, h, fps = vcfg["width"], vcfg["height"], vcfg["fps"]
    a, b = seg["in"], seg["out"]
    dur = b - a
    cmd = ["ffmpeg", "-hide_banner", "-nostdin", "-y", "-loglevel", "error",
           "-hwaccel", "videotoolbox", "-ss", f"{a:.6f}", "-t", f"{dur:.6f}", "-i", src]
    chain = [f"[0:v]fps={fps},scale={w}:{h},setsar=1,format=yuv420p[b0]"]
    last, k = "b0", 0
    for br in seg.get("broll", []) + seg.get("cards", []):
        k += 1
        off = snap(br["at"], fps) - a
        bdur = snap(br["dur"], fps)
        ext = os.path.splitext(br["file"])[1].lower()
        if ext in IMAGE_EXT:
            cmd += ["-loop", "1", "-framerate", str(fps), "-t", f"{bdur:.6f}", "-i", br["file"]]
        else:
            cmd += ["-ss", f"{br.get('in', 0):.6f}", "-t", f"{bdur:.6f}", "-i", br["file"]]
        if br.get("fit", "cover") == "cover":
            geom = f"scale={w}:{h}:force_original_aspect_ratio=increase,crop={w}:{h}"
        else:
            geom = f"scale={w}:{h}:force_original_aspect_ratio=decrease,pad={w}:{h}:(ow-iw)/2:(oh-ih)/2:black"
        zoom = float(br.get("zoom", 0))
        if zoom > 0 and ext in IMAGE_EXT:
            geom += (f",scale=w='trunc({w}*(1+{zoom}*t/{bdur:.3f})/2)*2':h='trunc({h}*(1+{zoom}*t/{bdur:.3f})/2)*2'"
                     f":eval=frame,crop={w}:{h}")
        fade_in = float(br.get("fade_in", br.get("fade", 0)))
        fade_out = float(br.get("fade_out", br.get("fade", 0)))
        alpha = ""
        if fade_in > 0 or fade_out > 0:
            alpha = ",format=yuva420p"
            if fade_in > 0:
                alpha += f",fade=t=in:st=0:d={fade_in}:alpha=1"
            if fade_out > 0:
                alpha += f",fade=t=out:st={bdur - fade_out:.3f}:d={fade_out}:alpha=1"
        chain.append(f"[{k}:v]fps={fps},{geom},setsar=1,format=yuv420p{alpha},"
                     f"setpts=PTS-STARTPTS+{off:.6f}/TB[o{k}]")
        chain.append(f"[{last}][o{k}]overlay=enable='between(t,{off:.6f},{off + bdur:.6f})':eof_action=pass[b{k}]")
        last = f"b{k}"
    tail = ""
    if seg.get("fade_in"):
        tail += f",fade=t=in:st=0:d={seg['fade_in']}"
    if seg.get("fade_out"):
        tail += f",fade=t=out:st={dur - seg['fade_out']:.3f}:d={seg['fade_out']}"
    if tail:
        chain.append(f"[{last}]null{tail}[vout]")
        last = "vout"
    cmd += ["-filter_complex", ";".join(chain), "-map", f"[{last}]", "-an", "-t", f"{dur:.6f}",
            "-c:v", vcfg["encoder"], "-profile:v", "high", "-b:v", vcfg["bitrate"],
            "-pix_fmt", "yuv420p", "-r", str(fps), "-g", str(fps), "-video_track_timescale", "30000",
            "-color_primaries", "bt709", "-color_trc", "bt709", "-colorspace", "bt709", out]
    run(cmd, dry)


HANDLE = 0.12  # запас звука по обе стороны отрезка для кроссфейда, с


def media_duration(path: str) -> float:
    r = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", path],
                       capture_output=True, text=True)
    return float(r.stdout.strip())


def build_audio(seg: dict, src: str, out: str, dry: bool) -> dict:
    """Пишет звук отрезка с запасом до и после; возвращает длины запасов."""
    asrc = seg.get("audio_src_path", src)
    a, b = seg["in"], seg["out"]
    pre = min(HANDLE, a)
    post = max(0.0, min(HANDLE, media_duration(asrc) - b))
    total = (b - a) + pre + post
    filters = ["aresample=48000"]
    if seg.get("afilter"):
        filters.append(seg["afilter"])
    if seg.get("gain_db"):
        filters.append(f"volume={seg['gain_db']}dB")
    if seg.get("fade_in"):
        filters.append(f"afade=t=in:st={pre:.4f}:d={seg['fade_in']}")
    if seg.get("fade_out"):
        filters.append(f"afade=t=out:st={pre + (b - a) - seg['fade_out']:.4f}:d={seg['fade_out']}")
    filters += [f"apad=whole_dur={total:.6f}", f"atrim=0:{total:.6f}"]
    cmd = ["ffmpeg", "-hide_banner", "-nostdin", "-y", "-loglevel", "error",
           "-ss", f"{a - pre:.6f}", "-t", f"{total:.6f}", "-i", asrc, "-vn",
           "-af", ",".join(filters), "-ac", "2", "-c:a", "pcm_f32le", out]
    run(cmd, dry)
    return {"pre": pre, "post": post, "dur": b - a}


def concat(files: list[str], out: str, dry: bool) -> None:
    lst = out + ".txt"
    with open(lst, "w") as f:
        for p in files:
            f.write("file '" + p.replace("'", "'\\''") + "'\n")
    run(["ffmpeg", "-hide_banner", "-nostdin", "-y", "-loglevel", "error",
         "-f", "concat", "-safe", "0", "-i", lst, "-c", "copy", out], dry)


def music_runs(layout: list, src_name: str, run: dict) -> list:
    """Куски старого трека в таймкодах результата — с запасами кроссфейда и весами, как в mix_segments.

    На склейке в миксе звучат хвост одного отрезка и запас следующего. Чтобы музыка вычиталась
    и там, кусок продлевается на запас отрезка и получает тот же линейный вес.
    """
    runs = []
    for seg in layout:
        if seg["src"] != src_name or min(run["b"], seg["out"]) - max(run["a"], seg["in"]) <= 0.05:
            continue
        xin, xout, end = seg["xin"], seg["xout"], seg["pos"] + seg["out"] - seg["in"]
        a, b = max(run["a"], seg["in"] - xin), min(run["b"], seg["out"] + xout)
        item = {"a": seg["pos"] + a - seg["in"], "b": seg["pos"] + b - seg["in"],
                "src_in": run["src_in"] + (a - run["a"])}
        if xin > 0:
            item["ramp_in"] = [seg["pos"] - xin, seg["pos"] + xin]
        if xout > 0:
            item["ramp_out"] = [end - xout, end + xout]
        runs.append(item)
    return runs


def to_output(layout: list, src_name: str, t0: float, t1: float) -> list:
    """Пересекает интервал источника с отрезками плана. Возвращает куски (t_src, out_a, out_b)."""
    pieces = []
    for seg in layout:
        if seg["src"] != src_name:
            continue
        a, b = max(t0, seg["in"]), min(t1, seg["out"])
        if b - a > 0.05:
            pieces.append((a, seg["pos"] + a - seg["in"], seg["pos"] + b - seg["in"]))
    return pieces


def build_remusic_spec(plan: dict, layout: list, audio_in: str, audio_out: str, work: str) -> str:
    rm = plan["remusic"]
    words = []
    for name, w in rm.get("words", {}).items():
        off = w.get("offset", 0.0)
        for sg in json.load(open(w["path"]))["segments"]:
            if sg.get("no_speech_prob", 0) > 0.6:
                continue
            for word in sg.get("words", []):
                for _, oa, ob in to_output(layout, name, word["start"] - off, max(word["end"] - off, word["start"] - off + 0.06)):
                    words.append({"start": oa, "end": ob})
    words_path = os.path.join(work, "words_output.json")
    json.dump({"segments": [{"words": sorted(words, key=lambda x: x["start"])}]}, open(words_path, "w"))
    jobs = []
    for job in rm["jobs"]:
        runs = [r for run in job["runs"] for r in music_runs(layout, job["src"], run)]
        if not runs:
            print(f"ВНИМАНИЕ: замена музыки «{job['name']}» не попала ни в один отрезок плана и пропущена")
            continue
        mute = []
        for m0, m1 in job.get("mute", []):
            mute += [[oa, ob] for _, oa, ob in to_output(layout, job["src"], m0, m1)]
        solo = []
        for m0, m1 in job.get("solo", []):
            solo += [[oa, ob] for _, oa, ob in to_output(layout, job["src"], m0, m1)]
        jobs.append({"name": job["name"],
                     "range": [max(0.0, min(r["a"] for r in runs)), max(r["b"] for r in runs)],
                     "old": job["old"], "runs": runs, "new": job["new"], "new_start": job.get("new_start", 0.0),
                     # точка входа нового трека — начало музыки в результате, без запаса кроссфейда
                     "new_at": min(oa for run in job["runs"] for _, oa, _ in to_output(layout, job["src"], run["a"], run["b"])),
                     "level_db": job.get("level_db", 0.0), "lift_db": job.get("lift_db", 4.0), "mute": mute,
                     "solo": solo, **({"bridge": job["bridge"]} if "bridge" in job else {})})
    if not jobs:
        raise SystemExit("ни одна замена музыки не попала в план: проверь таймкоды кусков и имя источника")
    spec_path = os.path.join(work, "remusic_spec.json")
    json.dump({"src": audio_in, "out": audio_out, "words": words_path, "words_offset": 0, "jobs": jobs},
              open(spec_path, "w"), ensure_ascii=False, indent=1)
    return spec_path


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("plan")
    ap.add_argument("--only-audio", action="store_true", help="пересобрать только звук и мастер")
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()

    plan = json.load(open(args.plan))
    out = plan["output"]
    if os.path.exists(out):
        raise SystemExit(f"файл уже существует, перезапись запрещена: {out}")
    work = plan["workdir"]
    segdir = os.path.join(work, "seg")
    os.makedirs(segdir, exist_ok=True)
    vcfg = {"width": 3840, "height": 2160, "fps": 30, "encoder": "h264_videotoolbox", "bitrate": "50M",
            **plan.get("video", {})}
    acfg = {"target_lufs": -14.0, "true_peak": -1.5, "leveler": 0.6, **plan.get("audio", {})}
    fps = vcfg["fps"]
    # правка фильтров в коде должна сбросить кеш кусков так же, как правка плана
    vcode, acode = digest(inspect.getsource(build_video)), digest(inspect.getsource(build_audio))

    vfiles, afiles, total, durations, layout = [], [], 0.0, {}, []
    for i, raw in enumerate(plan["segments"]):
        seg = dict(raw)
        src = plan["sources"][seg["src"]]
        seg["in"], seg["out"] = snap(seg["in"], fps), snap(seg["out"], fps)
        if seg["out"] <= seg["in"]:
            raise SystemExit(f"отрезок {i}: конец раньше начала")
        if seg["out"] - seg["in"] < 2 * HANDLE:
            raise SystemExit(f"отрезок {i}: короче {2 * HANDLE:.2f} с, кроссфейды соседних стыков пересекутся")
        if seg["out"] > durations.setdefault(src, media_duration(src)) + 1 / fps:
            raise SystemExit(f"отрезок {i}: конец {seg['out']:.2f} за пределами источника {durations[src]:.2f}")
        if seg.get("audio_src"):
            seg["audio_src_path"] = plan["sources"][seg["audio_src"]]
        overlays = seg.get("broll", []) + seg.get("cards", [])
        # перерисованный под тем же именем титр или заменённая перебивка должны сбросить кеш куска
        stamps = [[source_stamp(o["file"]) for o in overlays]] if overlays else []
        vkey = digest([source_stamp(src), seg["in"], seg["out"], seg.get("broll"), seg.get("cards"),
                       seg.get("fade_in"), seg.get("fade_out"), vcfg, vcode] + stamps)
        akey = digest([source_stamp(seg.get("audio_src_path", src)), seg["in"], seg["out"], seg.get("afilter"),
                       seg.get("gain_db"), seg.get("fade_in"), seg.get("fade_out"), HANDLE, acode])
        vout = os.path.join(segdir, f"v_{vkey}.mp4")
        aout = os.path.join(segdir, f"a_{akey}.wav")
        ameta = aout + ".json"
        dur = seg["out"] - seg["in"]
        print(f"[{i + 1}/{len(plan['segments'])}] {seg['src']} {seg['in']:.2f}-{seg['out']:.2f} ({dur:.2f}s) "
              f"→ {total:.2f}  {seg.get('note', '')}", flush=True)
        if not args.only_audio and not os.path.exists(vout):
            tmp = vout + ".part.mp4"
            build_video(seg, src, vcfg, tmp, args.dry_run)
            if not args.dry_run:
                os.replace(tmp, vout)
        if not (os.path.exists(aout) and os.path.exists(ameta)):
            tmp = aout + ".part.wav"
            info = build_audio(seg, src, tmp, args.dry_run)
            if not args.dry_run:
                # звук и его описание занимают свои места переименованием: оборванная запись не оставит
                # пару, которая выглядит готовой
                with open(ameta + ".part", "w") as f:
                    json.dump(info, f)
                os.replace(tmp, aout)
                os.replace(ameta + ".part", ameta)
        layout.append({"src": seg["src"], "in": seg["in"], "out": seg["out"], "pos": total})
        vfiles.append(vout)
        if not args.dry_run:
            afiles.append({"file": aout, **json.load(open(ameta))})
        total += dur
    if args.dry_run:
        return
    # полуширина кроссфейда на каждом стыке — та же, что считает mix_segments
    for i, seg in enumerate(layout):
        seg["xin"] = min(afiles[i]["pre"], afiles[i - 1]["post"]) if i > 0 else 0.0
        seg["xout"] = min(afiles[i]["post"], afiles[i + 1]["pre"]) if i + 1 < len(layout) else 0.0

    audio_cat = os.path.join(work, "audio_cat.wav")
    manifest = os.path.join(work, "audio_manifest.json")
    json.dump(afiles, open(manifest, "w"), ensure_ascii=False)
    run(["uv", "run", "-q", "--with", "numpy", "--with", "soundfile",
         os.path.join(HERE, "mix_segments.py"), manifest, audio_cat])
    def master_to(src_wav: str, dst_wav: str) -> None:
        run([sys.executable, os.path.join(HERE, "master_audio.py"), src_wav, dst_wav,
             "--target", str(acfg["target_lufs"]), "--tp", str(acfg["true_peak"]),
             "--leveler", str(acfg["leveler"]), "--highpass", str(acfg.get("highpass", 0))])

    master = os.path.join(work, "audio_master.wav")
    master_orig = None
    if plan.get("remusic"):
        audio_rm = os.path.join(work, "audio_cat_remusic.wav")
        spec_path = build_remusic_spec(plan, layout, audio_cat, audio_rm, work)
        run(["uv", "run", "-q", "--with", "numpy", "--with", "scipy", "--with", "soundfile",
             os.path.join(HERE, "remusic.py"), spec_path])
        master_to(audio_rm, master)
        master_orig = os.path.join(work, "audio_master_original_music.wav")
        master_to(audio_cat, master_orig)
    else:
        master_to(audio_cat, master)
    if args.only_audio:
        print("звук готов:", master)
        return

    video_cat = os.path.join(work, "video_cat.mp4")
    concat(vfiles, video_cat, False)
    tmp_out = os.path.join(os.path.dirname(out), "." + os.path.basename(out) + ".part.mp4")
    mux = ["ffmpeg", "-hide_banner", "-nostdin", "-y", "-loglevel", "error", "-i", video_cat, "-i", master]
    maps = ["-map", "0:v:0", "-map", "1:a:0"]
    meta = []
    if master_orig:
        mux += ["-i", master_orig]
        maps += ["-map", "2:a:0"]
        meta = ["-metadata:s:a:0", "title=Новая музыка", "-metadata:s:a:1", "title=Исходная музыка",
                "-disposition:a:0", "default", "-disposition:a:1", "0"]
    run(mux + maps + ["-c:v", "copy", "-c:a", "aac", "-b:a", "320k", "-ar", "48000"] + meta
        + ["-movflags", "+faststart", "-shortest", tmp_out])
    # место под результат занимается атомарно: если файл появился за время рендера, будет ошибка.
    # Жёсткая ссылка для этого не годится — съёмные диски с ExFAT её не поддерживают.
    try:
        os.close(os.open(out, os.O_CREAT | os.O_EXCL | os.O_WRONLY))
    except FileExistsError:
        raise SystemExit(f"за время сборки появился файл {out}; результат оставлен в {tmp_out}")
    os.replace(tmp_out, out)
    print(f"готово: {out}  длительность по плану {total:.2f} с")


if __name__ == "__main__":
    main()
