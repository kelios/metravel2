#!/usr/bin/env python3
"""Cache the site's own parallel texts for the `translations` set:

* quests.jsonl — every quest that has a translation, in each of its locales
  (ru, be, uk, pl, en), from the public metravel.by API; one line per quest per
  locale, the same shape as data/raw/quests.jsonl (export_corpus.quest_row);
* i18n.jsonl   — the site's UI strings from i18n/locales/<locale>/ of this
  repository, one line per key with every locale's value.

Usage:
    python3 -I scripts/ai-train/sources/site_translations.py --ai-home ~/metravel-ai

Output: <AI_HOME>/data/sources/site_translations/{quests.jsonl,i18n.jsonl,LICENSE,fetched_at.json}.
The build of the set reads only this cache; rerun the script to refresh it.
"""
from __future__ import annotations

import argparse
import json
import os
import re
import subprocess
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
REPO = HERE.parents[2]
sys.path.insert(0, str(HERE.parent))
from export_corpus import API, get, paginate, quest_row  # noqa: E402
from sources.common import cache_dir, write_meta  # noqa: E402

NAME = "site_translations"
LICENSE = "metravel.by own content (quest translations, site UI strings)"
LOCALES = ("ru", "be", "uk", "pl", "en")
I18N_DIR = REPO / "i18n" / "locales"
# One flat `'key': 'value',` (or `key: 'value',`, as in offline.ts) line of a
# locale module; nested objects and multi-line values are skipped.
PAIR_RE = re.compile(r"""^\s*(?:(['"])(?P<key>.+?)\1|(?P<ident>[A-Za-z_$][\w$]*))\s*:\s*(?P<q>['"])(?P<val>(?:\\.|(?!(?P=q)).)*)(?P=q)\s*,?\s*$""")
ESCAPES = {"n": "\n", "t": "\t", "'": "'", '"': '"', "\\": "\\"}


def unescape(value: str) -> str:
    return re.sub(r"\\(.)", lambda m: ESCAPES.get(m.group(1), m.group(0)), value)


def locale_files(locale_dir: Path) -> list[Path]:
    files = [locale_dir / "common.ts", locale_dir / "offline.ts", locale_dir / "questSeo.json"]
    for sub in ("generated", "static"):
        files += sorted(p for p in (locale_dir / sub).glob("*.ts") if p.name != "index.ts")
    return [p for p in files if p.exists()]


def read_strings(path: Path) -> dict[str, str]:
    if path.suffix == ".json":
        return {k: v for k, v in json.loads(path.read_text(encoding="utf-8")).items() if isinstance(v, str)}
    out = {}
    for line in path.read_text(encoding="utf-8").splitlines():
        m = PAIR_RE.match(line)
        if m:
            out[m.group("key") or m.group("ident")] = unescape(m.group("val"))
    return out


def snapshot_i18n(i18n_dir: Path) -> list[dict]:
    """[{ns, key, ru, be, …}] in the Russian files' order; ns is the file path inside the locale folder."""
    rows = []
    ru_dir = i18n_dir / "ru"
    for ru_file in locale_files(ru_dir):
        rel = ru_file.relative_to(ru_dir)
        ns = str(rel.with_suffix(""))
        values = {loc: read_strings(i18n_dir / loc / rel) if (i18n_dir / loc / rel).exists() else {} for loc in LOCALES}
        for key, ru in values["ru"].items():
            row = {"ns": ns, "key": key, **{loc: values[loc][key] for loc in LOCALES if key in values[loc]}}
            if len(row) > 3:  # ns, key, ru and at least one translation
                rows.append(row)
    return rows


def fetch_quests(path: Path, pause: float, limit: int | None) -> None:
    """Quests with at least one translation, every available locale of each; resumes an interrupted run."""
    done = set()
    if path.exists():
        for line in path.open(encoding="utf-8"):
            row = json.loads(line)
            done.add((row["id"], row.get("content_locale")))
    quests = 0
    with path.open("a", encoding="utf-8") as fh:
        for meta in paginate("/quests/", {}, pause):
            available = [loc for loc in LOCALES if loc in (meta.get("available_locales") or [])]
            if "ru" not in available or len(available) < 2:
                continue
            if limit and quests >= limit:
                break
            quests += 1
            for locale in available:
                if (meta["id"], locale) in done:
                    continue
                row = quest_row(get(f"{API}/quests/{meta['id']}/?lang={locale}", pause), meta)
                if row.get("content_locale") != locale:
                    print(f"quest {meta['id']}: asked {locale}, got {row.get('content_locale')} — skipped", file=sys.stderr)
                    continue
                fh.write(json.dumps(row, ensure_ascii=False) + "\n")
                fh.flush()
                print(f"quest {meta['id']}/{locale} {row['title']}", file=sys.stderr)


def quest_counts(path: Path) -> dict:
    rows = [json.loads(line) for line in path.open(encoding="utf-8")] if path.exists() else []
    return {"quests": len({r["id"] for r in rows}), **{f"quests_{loc}": sum(r.get("content_locale") == loc for r in rows) for loc in LOCALES}}


def git_commit(path: Path) -> str | None:
    res = subprocess.run(["git", "-C", str(REPO), "log", "-1", "--format=%H", "--", str(path)], capture_output=True, text=True)
    return res.stdout.strip() or None


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--ai-home", default=None, help="training folder (default: $AI_HOME)")
    ap.add_argument("--i18n-dir", default=str(I18N_DIR), help="i18n/locales of the repository")
    ap.add_argument("--pause", type=float, default=0.3, help="seconds between API requests")
    ap.add_argument("--limit", type=int, default=None, help="stop after N translated quests (smoke run)")
    ap.add_argument("--skip-quests", action="store_true", help="refresh only the UI strings")
    args = ap.parse_args()
    home = Path(args.ai_home or os.environ.get("AI_HOME") or ".").expanduser()
    out = cache_dir(home / "data" / "sources", NAME)

    i18n_dir = Path(args.i18n_dir).expanduser()
    strings = snapshot_i18n(i18n_dir)
    if not strings:
        print(f"{i18n_dir}: no UI strings found, cache left untouched", file=sys.stderr)
        return 1
    with (out / "i18n.jsonl").open("w", encoding="utf-8") as fh:
        for row in strings:
            fh.write(json.dumps(row, ensure_ascii=False) + "\n")
    counts = {"i18n_keys": len(strings), **{f"i18n_{loc}": sum(loc in r for r in strings) for loc in LOCALES[1:]}}
    if not args.skip_quests:
        fetch_quests(out / "quests.jsonl", args.pause, args.limit)
    counts.update(quest_counts(out / "quests.jsonl"))
    meta = write_meta(out, license=LICENSE, origin=f"{API}/quests/ + {i18n_dir}",
                      extra={"counts": counts, "i18n_commit": git_commit(i18n_dir)})
    print(json.dumps(meta, ensure_ascii=False), file=sys.stderr)
    return 0


if __name__ == "__main__":
    sys.exit(main())
