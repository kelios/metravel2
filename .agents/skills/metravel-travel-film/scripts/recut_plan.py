#!/usr/bin/env python3
"""Следующий круг правок: вырезки и перебивки задаются в таймкодах прошлого результата.

Запуск: python3 recut_plan.py round.json

Рецензент называет таймкоды готового файла, а план сборки хранит таймкоды
источников. Скрипт переводит одно в другое и пишет новый план.

round.json:
{
  "base_plan": "/путь/plan_v2.json",          # план, которым собран прошлый результат
  "out_plan": "/путь/plan_v3.json",
  "output": "/путь/Фильм — правка v3.mp4",
  "result_audio": "/путь/v2/audio_full.wav",  # звук прошлого результата (WAV 16 бит) для привязки к паузам
  "cuts": [{"a": 266.3, "b": 281.9, "note": "реплика о посторонних", "snap": true}],
  "broll": [{"start": 439.4, "dur": 6.0, "file": "/путь/фото.jpg", "in": 0, "zoom": 0.03}],
  "baked": {"day2": [[495.17, 503.83], [516.37, 523.37]]}   # перебивки, уже вшитые в источник (его таймкоды)
}

Что делает:
- каждую границу вырезки сдвигает в самую тихую точку в пределах ±0,25 с
  ("snap": false оставляет как есть — для границ на склейке планов);
- делит отрезки плана, сохраняя усиление, титры и прежние перебивки;
- перебивку, которая закрывает вырезку, делит на куски по обе стороны стыка;
- печатает обрывки планов короче секунды рядом с вшитыми перебивками: такую
  границу надо сдвинуть на край перебивки или расширить вырезку;
- печатает таблицу вырезок и новую длительность.
Таймкод начала перебивки не должен попадать внутрь вырезки.
"""
import json
import math
import struct
import sys
import wave

FPS = 30


def snapf(t: float) -> float:
    return round(t * FPS) / FPS


def tc(t: float) -> str:
    return f"{int(t // 60):02d}:{t % 60:05.2f}"


def main() -> None:
    rnd = json.load(open(sys.argv[1]))
    plan = json.load(open(rnd["base_plan"]))

    lay, pos = [], 0.0
    for s in plan["segments"]:
        a, b = snapf(s["in"]), snapf(s["out"])
        lay.append(dict(s, **{"in": a, "out": b, "pos": pos}))
        pos += b - a
    old_dur = pos

    wav = wave.open(rnd["result_audio"])
    sr = wav.getframerate()

    def rms(t: float, d: float = 0.05) -> float:
        wav.setpos(max(0, int(t * sr)))
        raw = wav.readframes(int(d * sr))
        n = len(raw) // 2
        v = struct.unpack("<%dh" % n, raw)
        return math.sqrt(sum(x * x for x in v) / max(1, n))

    def quiet(t: float, win: float = 0.25) -> float:
        best, k = (1e18, t), -win
        while k <= win + 1e-9:
            r = rms(t + k - 0.025)
            if r < best[0] - 1e-9:
                best = (r, t + k)
            k += 0.05
        return best[1]

    cuts = []
    for c in rnd.get("cuts", []):
        snap = c.get("snap", True)
        cuts.append((quiet(c["a"]) if snap else c["a"], quiet(c["b"]) if snap else c["b"], c.get("note", "")))

    def old_to_src(t: float):
        for s in lay:
            if s["pos"] - 1e-6 <= t < s["pos"] + (s["out"] - s["in"]) + 1e-6:
                return s, s["in"] + (t - s["pos"])
        raise SystemExit(f"таймкод {t} за пределами прошлого результата")

    segs = []
    for s in lay:
        pieces = [(s["in"], s["out"])]
        for a, b, _ in cuts:
            sa, sb = s["in"] + (a - s["pos"]), s["in"] + (b - s["pos"])
            new = []
            for x, y in pieces:
                if sb <= x or sa >= y:
                    new.append((x, y))
                    continue
                if sa - x > 0.3:
                    new.append((x, sa))
                if y - sb > 0.3:
                    new.append((sb, y))
            pieces = new
        for x, y in pieces:
            d = {k: v for k, v in s.items() if k not in ("pos", "broll", "cards")}
            d["in"], d["out"] = snapf(x), snapf(y)
            for key in ("broll", "cards"):
                kept = []
                for o in s.get(key, []):
                    oa, ob = max(o["at"], d["in"]), min(o["at"] + o["dur"], d["out"])
                    if ob - oa > 0.05:
                        e = dict(o, at=round(oa, 4), dur=round(ob - oa, 4))
                        if "in" in o:
                            e["in"] = round(o["in"] + (oa - o["at"]), 4)
                        kept.append(e)
                if kept:
                    d[key] = kept
            segs.append(d)

    def find(src: str, t: float):
        for d in segs:
            if d["src"] == src and d["in"] - 1e-6 <= t < d["out"]:
                return d
        return None

    for br in rnd.get("broll", []):
        s0, t = old_to_src(br["start"])
        d = find(s0["src"], t)
        if d is None:
            raise SystemExit(f"перебивка {br['start']} начинается внутри вырезки")
        i, left, at, off, first = segs.index(d), br["dur"], t, br.get("in", 0.0), True
        is_video = br["file"].lower().endswith((".mov", ".mp4", ".m4v"))
        while left > 0.02 and i < len(segs):
            d = segs[i]
            if not first:
                at = d["in"]
            take = min(left, d["out"] - at)
            if take > 0.05:
                e = {"at": round(at, 4), "dur": round(take, 4), "file": br["file"]}
                if is_video:
                    e["in"] = round(off, 4)
                # наезд только на цельной перебивке: на стыке кусков картинка прыгнула бы назад
                if br.get("zoom") and first and take >= br["dur"] - 0.05:
                    e["zoom"] = br["zoom"]
                d.setdefault("broll", []).append(e)
            left -= take
            off += take
            i += 1
            first = False

    print("короткие обрывки планов рядом с вшитыми перебивками (<1,0 с):")
    for src, ivs in rnd.get("baked", {}).items():
        bounds = sorted({x for a, b in ivs for x in (a, b)})
        for d in segs:
            if d["src"] != src:
                continue
            pts = [d["in"]] + [x for x in bounds if d["in"] < x < d["out"]] + [d["out"]]
            for a, b in zip(pts, pts[1:]):
                if 0.05 < b - a < 1.0:
                    print(f"  {src} {d['in']:.2f}-{d['out']:.2f}: обрывок {a:.2f}-{b:.2f} ({b - a:.2f} с)")

    out = dict(plan)
    out["segments"] = segs
    out["output"] = rnd["output"]
    json.dump(out, open(rnd["out_plan"], "w"), ensure_ascii=False, indent=1)
    new_dur = sum(d["out"] - d["in"] for d in segs)
    print(f"длительность {tc(old_dur)} → {tc(new_dur)}, отрезков {len(segs)}")
    for a, b, note in cuts:
        print(f"  {tc(a)}-{tc(b)} ({b - a:5.1f} с) {note}")


if __name__ == "__main__":
    main()
