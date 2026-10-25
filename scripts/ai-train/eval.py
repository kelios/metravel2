#!/usr/bin/env python3
"""Side-by-side evaluation of the base model and a LoRA adapter on the fixed
prompt sets, one file per slice (eval_prompts/<set>.jsonl, docs/AI_TRAIN_DATASETS.md
§ 5): generates both answers for every prompt, checks them automatically against
the exported corpus and scores every slice separately.

Usage (inside the training folder's venv, model/adapter paths relative to it):
    AI_HOME=~/metravel-ai ~/metravel-ai/venv/bin/python scripts/ai-train/eval.py \
        --adapter adapters/metravel-llm-v0 --out logs/eval-v0
    # one slice or another prompt folder: --prompts eval_prompts/site.jsonl, --prompts-dir <dir>

Automatic checks per answer:
  * urls_ok      — every metravel.by URL in the answer exists in data/raw
                   (article slug, quest URL or the two catalogue pages);
  * urls_unknown — links to metravel.by pages that do not exist (made up);
  * external     — links to other sites (forbidden by the system prompt);
  * refused      — the answer says the site has no material on the topic.
  * lang         — the answer's language by its letters (ru, be, uk, pl, en),
                   URLs left out;
  * degenerate   — a letter repeated 6+ times in a row (a weak language
                   falling into a loop, "шасццццц…").
A prompt with expect=answer passes when there is at least one known URL,
no unknown and no external link; expect=refuse passes when the model refuses
and invents no URL; expect=lang (the translations slice) is expect=answer in
the prompt's `lang`: the language matches, at least one known URL, no unknown
or external link and no degenerate loop. The v2 slices (#2477–#2479) add:
  * expect=exact (toponyms) — every regex in `accept` matches the answer, none
    of `reject` does, no unknown or external URL;
  * expect=info (wikivoyage) — an informative answer without any link: ≥ 200
    characters, no URL at all (known pages included — the model has no
    material and must not pretend), the prompt's language, no degenerate
    loop, `accept` regexes if given;
  * expect=json (osm_intents) — the first {…} in the answer parses and passes
    sets.osm_intents.validate_filter() (osm_filter_schema.json), `accept`
    regexes if given.
The assistant-mode slices (#2712) carry the screen's own system prompt in the
prompt's `system` field (assistant_prompt.json) and the cards in `prompt`:
  * expect=rag (rag_answers) — at least one known URL, none unknown or
    external, at most `max_urls` distinct URLs (default 3), the prompt's
    language, no degenerate loop and none of the `reject` regexes (the site
    set's article template «Страна: / Точки маршрута:»);
  * expect=offtopic — the refusal of assistant_prompt.json (the model names
    itself the metravel.by assistant) and no URL at all.
Factual accuracy, tone and the quality of a translation (Russian words inside
a Belarusian answer pass the letter check) are still read by a human — the
report leaves a column for that.

Output: <out>/results.jsonl (both answers + checks) and <out>/report.md.
"""
from __future__ import annotations

import argparse
import json
import re
import sys
import time
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
from sets.common import SITE, SYSTEM  # noqa: E402
from sets.osm_intents import extract_json, validate_filter  # noqa: E402

URL_RE = re.compile(r"https?://[^\s)\]>»\"']+")
OFFTOPIC_RE = re.compile(r"(?:ассистент|асістэнт|асистент|asystent\w*|assistant)\s+metravel\.by|metravel\.by\s+(?:travel\s+)?assistant", re.I)
REFUSE_RE = re.compile(r"(пока\s+)?нет\s+(материал|стат|квест|ничего)|не\s+нашл|нет\s+информации|brak\s+materia|nie\s+ma(my)?\s+(materia|artyku)", re.I)
THINK_RE = re.compile(r"<think>.*?</think>\s*", re.S)
LETTER_RE = re.compile(r"[^\W\d_]")
DEGENERATE_RE = re.compile(r"([^\W\d_])\1{5,}")
PLACEHOLDER_RE = re.compile(r"\{\{[^}]*\}\}")
POLISH = set("ąćęłńśźżó")
CYRILLIC_NEVER = {"ru": "іўїєґ", "be": "ищъїєґ", "uk": "ыэёъў"}  # dict order breaks ties
LATIN_WORD_RE = re.compile(r"[a-ząćęłńśźżó]+")
PL_RE = re.compile(r"sz|cz|rz|dz|ie|ow|ych|\b(?:i|w|z|na|nie|jest|się|do)\b")
EN_RE = re.compile(r"th|wh|sh|ea|ou|ing\b|\b(?:a|an|the|and|of|to|is|in|for)\b")


def known_urls(raw: Path) -> set[str]:
    urls = {f"{SITE}/travels", f"{SITE}/quests", f"{SITE}/travels/", f"{SITE}/quests/", SITE, SITE + "/"}
    for line in (raw / "travels.jsonl").open(encoding="utf-8"):
        t = json.loads(line)
        urls.add(f"{SITE}/travels/{t['slug']}")
    qf = raw / "quests.jsonl"
    if qf.exists():
        for line in qf.open(encoding="utf-8"):
            q = json.loads(line)
            if q.get("url"):
                urls.add(q["url"].rstrip("/"))
            if q.get("city_alias") and q.get("quest_id"):
                # the assistant's cards carry buildQuestPath(city_alias, quest_id)
                urls.add(f"{SITE}/quests/{q['city_alias']}/{q['quest_id']}")
    return urls


def load_prompts(files: list[Path]) -> list[dict]:
    """Prompts of every slice in file order; the slice is the file name (site.jsonl → site)."""
    if not files:
        raise SystemExit("no prompt files")
    prompts, seen = [], set()
    for f in files:
        for line in f.open(encoding="utf-8"):
            if not line.strip():
                continue
            p = {**json.loads(line), "slice": f.stem}
            if (p["slice"], p["id"]) in seen:
                raise SystemExit(f"{f}: duplicate prompt id {p['id']}")
            seen.add((p["slice"], p["id"]))
            prompts.append(p)
    return prompts


def detect_lang(text: str) -> str | None:
    """ru / be / uk / pl / en by letter statistics, or None without letters.

    Cyrillic: each language is scored by the letters it never uses (Russian:
    і ў ї є ґ; Belarusian: и щ ъ ї є ґ; Ukrainian: ы э ё ъ ў), the fewest wins,
    ties go to Russian, then Belarusian. Latin: Polish diacritics and digraphs
    against English ones. Placeholders and URLs are left out.
    """
    text = PLACEHOLDER_RE.sub(" ", URL_RE.sub(" ", text)).lower()
    letters = LETTER_RE.findall(text)
    cyr = "".join(ch for ch in letters if "а" <= ch <= "я" or ch in "ёіўїєґ")
    lat = "".join(ch for ch in letters if "a" <= ch <= "z" or ch in POLISH)
    if not cyr and not lat:
        return None
    if len(lat) > len(cyr):
        words = " ".join(LATIN_WORD_RE.findall(text))
        pl = 3 * sum(ch in POLISH for ch in lat) + len(PL_RE.findall(words))
        en = len(EN_RE.findall(words))
        return "pl" if pl > en else "en"
    bad = {lang: sum(cyr.count(ch) for ch in never) for lang, never in CYRILLIC_NEVER.items()}
    return min(bad, key=lambda lang: bad[lang])


def check(answer: str, known: set[str]) -> dict:
    found = [u.rstrip(".,;:/") for u in URL_RE.findall(answer)]
    ours = [u for u in found if u.startswith(SITE)]
    external = [u for u in found if not u.startswith(SITE)]
    unknown = [u for u in ours if u not in known]
    return {
        "urls": found,
        "urls_ok": len(ours) - len(unknown),
        "urls_unknown": unknown,
        "external": external,
        "refused": bool(REFUSE_RE.search(answer)),
        "lang": detect_lang(answer),
        "degenerate": bool(DEGENERATE_RE.search(URL_RE.sub(" ", answer))),
        "json_ok": (lambda obj: obj is not None and not validate_filter(obj))(extract_json(answer)),
    }


INFO_MIN_CHARS = 200


def matches(answer: str, patterns: list[str] | None) -> bool:
    return all(re.search(p, answer, re.I | re.M) for p in patterns or [])


def verdict(p: dict, c: dict, answer: str) -> bool:
    expect, lang = p["expect"], p.get("lang")
    if c["external"] or c["urls_unknown"]:
        return False
    if expect == "lang":
        return c["lang"] == lang and c["urls_ok"] > 0 and not c["degenerate"]
    if expect == "refuse":
        return c["refused"]
    if expect == "exact":
        return matches(answer, p.get("accept")) and not any(re.search(r, answer, re.I | re.M) for r in p.get("reject") or [])
    if expect == "info":
        return (not c["urls"] and len(answer) >= INFO_MIN_CHARS and not c["degenerate"]
                and (not lang or c["lang"] == lang) and matches(answer, p.get("accept")))
    if expect == "json":
        return c["json_ok"] and matches(answer, p.get("accept"))
    if expect == "rag":
        return (0 < c["urls_ok"] and len(set(c["urls"])) <= p.get("max_urls", 3) and not c["degenerate"]
                and (not lang or c["lang"] == lang) and not any(re.search(r, answer, re.I | re.M) for r in p.get("reject") or []))
    if expect == "offtopic":
        return not c["urls"] and bool(OFFTOPIC_RE.search(answer))
    return c["urls_ok"] > 0


def generate_all(model_path: str, adapter: str | None, prompts: list[dict], max_tokens: int) -> tuple[list[str], float]:
    from mlx_lm import load, generate
    from mlx_lm.sample_utils import make_sampler

    model, tokenizer = load(model_path, adapter_path=adapter)
    sampler = make_sampler(temp=0.0)
    out, toks, secs = [], 0, 0.0
    for i, p in enumerate(prompts, 1):
        msgs = [{"role": "system", "content": p.get("system", SYSTEM)}, {"role": "user", "content": p["prompt"]}]
        text = tokenizer.apply_chat_template(msgs, add_generation_prompt=True, tokenize=False, enable_thinking=False)
        t0 = time.time()
        ans = generate(model, tokenizer, prompt=text, max_tokens=max_tokens, sampler=sampler, verbose=False)
        secs += time.time() - t0
        toks += len(tokenizer.encode(ans))
        ans = THINK_RE.sub("", ans).strip()
        out.append(ans)
        print(f"  [{i}/{len(prompts)}] {p['id']} {len(ans)} chars", file=sys.stderr)
    return out, (toks / secs if secs else 0.0)


def generate_server(url: str, prompts: list[dict], max_tokens: int) -> tuple[list[str], float]:
    """Same prompts through an OpenAI-compatible llama-server (#2463: GGUF after
    quantisation). Greedy, thinking off, one request at a time; tokens/s from
    the server's own `usage` and timings."""
    import urllib.request

    out, toks, secs = [], 0, 0.0
    for i, p in enumerate(prompts, 1):
        body = {
            "messages": [{"role": "system", "content": p.get("system", SYSTEM)}, {"role": "user", "content": p["prompt"]}],
            "max_tokens": max_tokens,
            "temperature": 0.0,
            "top_k": 1,
            "stream": False,
            "chat_template_kwargs": {"enable_thinking": False},
        }
        req = urllib.request.Request(
            url.rstrip("/") + "/v1/chat/completions",
            data=json.dumps(body).encode("utf-8"),
            headers={"Content-Type": "application/json"},
        )
        t0 = time.time()
        with urllib.request.urlopen(req, timeout=600) as resp:
            data = json.loads(resp.read().decode("utf-8"))
        wall = time.time() - t0
        ans = THINK_RE.sub("", data["choices"][0]["message"]["content"] or "").strip()
        timings = data.get("timings") or {}
        if timings.get("predicted_n") and timings.get("predicted_ms"):
            # generation-only speed, comparable with the MLX column (prompt processing excluded)
            toks += int(timings["predicted_n"])
            secs += float(timings["predicted_ms"]) / 1000.0
        else:
            toks += int((data.get("usage") or {}).get("completion_tokens") or 0)
            secs += wall
        out.append(ans)
        print(f"  [{i}/{len(prompts)}] {p['id']} {len(ans)} chars", file=sys.stderr)
    return out, (toks / secs if secs else 0.0)


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--ai-home", default=None, help="training folder (default: $AI_HOME)")
    ap.add_argument("--model", default="models/Qwen3.5-4B-MLX-4bit")
    ap.add_argument("--adapter", default="adapters/metravel-llm-v0")
    ap.add_argument("--prompts-dir", default=str(HERE / "eval_prompts"), help="one <slice>.jsonl per dataset set")
    ap.add_argument("--prompts", default=None, help="a single prompt file instead of --prompts-dir")
    ap.add_argument("--out", default="logs/eval")
    ap.add_argument("--max-tokens", type=int, default=500)
    ap.add_argument("--skip-base", action="store_true", help="reuse base answers from <out>/base.json")
    ap.add_argument("--server", default=None, metavar="URL",
                    help="evaluate a llama-server (OpenAI API, e.g. http://127.0.0.1:8081) instead of the MLX adapter; "
                         "the 'adapter' column is then the GGUF, --adapter is only a label")
    ap.add_argument("--base-server", default=None, metavar="URL",
                    help="llama-server with the base GGUF for the 'base' column (default: MLX base, or <out>/base.json with --skip-base)")
    args = ap.parse_args()
    import os
    home = Path(args.ai_home or os.environ.get("AI_HOME") or ".").expanduser()
    out = home / args.out
    out.mkdir(parents=True, exist_ok=True)
    prompts = load_prompts([Path(args.prompts)] if args.prompts else sorted(Path(args.prompts_dir).glob("*.jsonl")))
    known = known_urls(home / "data" / "raw")

    base_file = out / "base.json"
    base_source = args.base_server or args.model  # which engine produced the cached base answers
    cached = json.loads(base_file.read_text(encoding="utf-8")) if args.skip_base and base_file.exists() else None
    texts = [p["prompt"] for p in prompts]
    if (cached and cached.get("source", args.model) == base_source
            and len(cached["answers"]) == len(prompts) and cached.get("prompts", texts) == texts):
        base_ans, base_tps = cached["answers"], cached["tps"]
    else:
        if cached:
            print(f"== base.json is from {cached.get('source', args.model)} or another prompt set, regenerating for {base_source}", file=sys.stderr)
        print("== base", base_source, file=sys.stderr)
        if args.base_server:
            base_ans, base_tps = generate_server(args.base_server, prompts, args.max_tokens)
        else:
            base_ans, base_tps = generate_all(str(home / args.model), None, prompts, args.max_tokens)
        base_file.write_text(json.dumps({"source": base_source, "prompts": texts, "answers": base_ans, "tps": base_tps}, ensure_ascii=False), encoding="utf-8")
    print("== adapter", args.server or args.adapter, file=sys.stderr)
    if args.server:
        ad_ans, ad_tps = generate_server(args.server, prompts, args.max_tokens)
    else:
        ad_ans, ad_tps = generate_all(str(home / args.model), str(home / args.adapter), prompts, args.max_tokens)

    rows, totals, slices = [], {"base": {}, "v": {}}, {"base": {}, "v": {}}
    with (out / "results.jsonl").open("w", encoding="utf-8") as fh:
        for p, b, a in zip(prompts, base_ans, ad_ans):
            cb, ca = check(b, known), check(a, known)
            row = {**p, "base": {"answer": b, **cb, "pass": verdict(p, cb, b)},
                   "adapter": {"answer": a, **ca, "pass": verdict(p, ca, a)}}
            rows.append(row)
            fh.write(json.dumps(row, ensure_ascii=False) + "\n")
            for side, key in (("base", "base"), ("v", "adapter")):
                for table, name in ((totals, f"{p['slice']} / {p['group']}"), (slices, p["slice"])):
                    g = table[side].setdefault(name, [0, 0])
                    g[0] += int(row[key]["pass"])
                    g[1] += 1

    def cell(r: dict) -> str:
        flags = []
        if r["urls_ok"]:
            flags.append(f"{r['urls_ok']} наших URL")
        if r["urls_unknown"]:
            flags.append(f"{len(r['urls_unknown'])} выдуманных")
        if r["external"]:
            flags.append(f"{len(r['external'])} чужих")
        if r["refused"]:
            flags.append("отказ")
        if r.get("degenerate"):
            flags.append("зацикливание")
        if r.get("json_ok"):
            flags.append("JSON по схеме")
        lang = f", язык {r['lang']}" if r.get("lang") else ""
        return ("✅" if r["pass"] else "❌") + " " + (", ".join(flags) or "без ссылок") + lang

    md = [f"# Оценка {args.adapter} против базы", "", f"База: {base_tps:.1f} ток/с, адаптер: {ad_tps:.1f} ток/с (генерация, greedy, max {args.max_tokens}).", ""]
    for title, table in (("срез", slices), ("срез / группа", totals)):
        md += [f"| {title} | база | адаптер |", "| --- | --- | --- |"]
        for g in table["v"]:
            md.append(f"| {g} | {table['base'][g][0]}/{table['base'][g][1]} | {table['v'][g][0]}/{table['v'][g][1]} |")
        md.append("")
    md += ["| id | срез | группа | вопрос | ожидание | база | адаптер | ручная оценка |", "| --- | --- | --- | --- | --- | --- | --- | --- |"]
    for r in rows:
        md.append(f"| {r['id']} | {r['slice']} | {r['group']} | {r['prompt']} | {r['expect']} | {cell(r['base'])} | {cell(r['adapter'])} |  |")
    md += ["", "## Ответы", ""]
    for r in rows:
        md += [f"### {r['id']} — {r['prompt']}", "", "**База:**", "", r["base"]["answer"] or "_(пусто)_", "", f"**{args.adapter}:**", "", r["adapter"]["answer"] or "_(пусто)_", ""]
    (out / "report.md").write_text("\n".join(md), encoding="utf-8")
    print(json.dumps({"base_tps": round(base_tps, 1), "adapter_tps": round(ad_tps, 1), "slices": slices, "totals": totals}, ensure_ascii=False), file=sys.stderr)
    print(out / "report.md")
    return 0


if __name__ == "__main__":
    sys.exit(main())
