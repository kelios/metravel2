import fs from 'fs';
import os from 'os';
import path from 'path';
import { spawnSync } from 'child_process';
import { makeTempDir, removeDir, runCli } from './cli-test-utils';

// #2479: полный источник OSM из страновых PBF-экстрактов (sources/osm_pbf.py) —
// крошечный файл-фикстура: предикат тегов, граница страны, геометрия way/relation,
// отсутствующий член и цикл. Нужен Python с pyosmium и Shapely (изолированное
// окружение ~/metravel-ai/venv-osm или AI_OSM_PYTHON); без них тест пропускается.
const DIR = path.resolve(process.cwd(), 'scripts/ai-train');

const findPython = (): string | null => {
  const candidates = [process.env.AI_OSM_PYTHON, path.join(os.homedir(), 'metravel-ai/venv-osm/bin/python'), 'python3'].filter(
    (p): p is string => Boolean(p),
  );
  for (const candidate of candidates) {
    if (candidate.includes('/') && !fs.existsSync(candidate)) continue;
    const probe = spawnSync(candidate, ['-I', '-c', 'import osmium, shapely'], { encoding: 'utf8' });
    if (probe.status === 0) return candidate;
  }
  return null;
};

const PYTHON = findPython();
const itWithOsmium = PYTHON ? it : it.skip;

describe('ai-train osm_pbf source (#2479)', () => {
  itWithOsmium('tiny extract: tags predicate, country polygon, way/relation geometry, missing member and cycle', () => {
    const work = makeTempDir('ai-train-osm-pbf-');
    try {
      const code = `
import io, json, sys
sys.path.insert(0, sys.argv[1])
import osmium
from osmium.osm import mutable
from shapely.geometry import box
from shapely.prepared import prep
from pathlib import Path
from sources import osm_pbf

work = Path(sys.argv[2])
pbf = work / "tiny.osm.pbf"
w = osmium.SimpleWriter(str(pbf))
def node(i, lon, lat, tags=None):
    w.add_node(mutable.Node(id=i, location=(lon, lat), tags=tags or {}, version=1, visible=True))
node(1, 27.56, 53.9, {"tourism": "museum", "name": "Музей", "wikidata": "Q1"})       # inside → accepted
node(2, 25.28, 54.69, {"tourism": "museum", "name": "Muziejus", "wikidata": "Q2"})    # outside polygon → rejected_country
node(3, 26.3, 53.1, {"natural": "peak", "name": "Гара", "ele": "345"})                # peak with ele → accepted
node(4, 27.6, 53.95, {"tourism": "museum", "name": "Без викидаты"})                  # no wikidata → not a candidate
for i, (lon, lat) in enumerate([(26.47, 53.45), (26.48, 53.45), (26.48, 53.46), (26.47, 53.46)], start=10):
    node(i, lon, lat)
for i, (lon, lat) in enumerate([(30.0, 52.5), (30.01, 52.5), (30.01, 52.51)], start=20):
    node(i, lon, lat)
node(30, 28.0, 54.0)
w.add_way(mutable.Way(id=100, nodes=[10, 11, 12, 13, 10], tags={"historic": "castle", "name": "Замак", "wikidata": "Q100"}, version=1, visible=True))
w.add_way(mutable.Way(id=101, nodes=[20, 21, 22, 20], tags={}, version=1, visible=True))
w.add_relation(mutable.Relation(id=200, members=[("w", 101, "outer"), ("n", 30, "")], tags={"historic": "ruins", "name": "Руіны", "wikidata": "Q200"}, version=1, visible=True))
w.add_relation(mutable.Relation(id=201, members=[("w", 999999, "outer")], tags={"amenity": "place_of_worship", "name": "Касцёл", "wikidata": "Q201"}, version=1, visible=True))
w.add_relation(mutable.Relation(id=202, members=[("n", 30, "")], tags={}, version=1, visible=True))
w.add_relation(mutable.Relation(id=203, members=[("r", 202, "")], tags={"tourism": "attraction", "name": "Комплекс", "wikidata": "Q203"}, version=1, visible=True))
w.add_relation(mutable.Relation(id=204, members=[("r", 205, "")], tags={"tourism": "attraction", "name": "Цыкл", "wikidata": "Q204"}, version=1, visible=True))
w.add_relation(mutable.Relation(id=205, members=[("r", 204, "")], tags={}, version=1, visible=True))
w.close()

# a Belarus-like rectangle: Vilnius (25.28, 54.69) is outside only by the real border, so it starts east of it
polygon = prep(box(25.5, 51.2, 32.8, 56.2))
out = io.StringIO()
counts = osm_pbf.scan_extract(pbf, "BY", polygon, out, work)
rows = [json.loads(line) for line in out.getvalue().splitlines()]
print(json.dumps({"counts": counts, "rows": {r["id"]: [r["country"], r["lat"], r["lon"], r["tags"]] for r in rows}}, ensure_ascii=False))
`;
      const res = runCli(PYTHON as string, ['-I', '-c', code, DIR, work]);
      expect(res.stderr).toBe('');
      const out = JSON.parse(res.stdout);
      expect(out.counts).toEqual({ candidates_n: 3, candidates_w: 1, candidates_r: 4, accepted: 5, rejected_country: 1, rejected_geometry: 2 });
      expect(Object.keys(out.rows).sort()).toEqual(['node/1', 'node/3', 'relation/200', 'relation/203', 'way/100']);
      expect(out.rows['way/100']).toEqual(['BY', 53.455, 26.475, { name: 'Замак', historic: 'castle', wikidata: 'Q100' }]);
      expect(out.rows['relation/200'].slice(0, 3)).toEqual(['BY', 53.25, 29.005]);
      expect(out.rows['relation/203'].slice(0, 3)).toEqual(['BY', 54.0, 28.0]);
      expect(out.rows['node/3'][3]).toEqual({ name: 'Гара', natural: 'peak', ele: '345' });
    } finally {
      removeDir(work);
    }
  });

  it('matches_tags: the shared Overpass/PBF predicate', () => {
    const res = runCli('python3', [
      '-I',
      '-c',
      `import sys, json
sys.path.insert(0, sys.argv[1])
from sources.osm import matches_tags
print(json.dumps([
  matches_tags({"tourism": "museum", "name": "a", "wikidata": "Q1"}),
  matches_tags({"tourism": "museum", "name": "a"}),
  matches_tags({"historic": "castle", "wikidata": "Q1"}),
  matches_tags({"amenity": "place_of_worship", "name": "a", "wikidata": "Q1"}),
  matches_tags({"natural": "peak", "name": "a"}),
  matches_tags({"natural": "peak", "name": "a", "ele": "100"}),
  matches_tags({"tourism": "camp_site", "name": "a"}),
  matches_tags({"tourism": "hotel", "name": "a", "wikidata": "Q1"}),
]))`,
      DIR,
    ]);
    expect(res.stderr).toBe('');
    expect(JSON.parse(res.stdout)).toEqual([true, false, false, true, false, true, true, false]);
  });
  it('osm.py keeps a complete PBF cache when an Overpass run covers only one country', () => {
    const home = makeTempDir('ai-train-osm-guard-');
    try {
      // every BY tile is cached (offline, no network) — only the --countries subset makes the run partial
      const seed = runCli('python3', [
        '-I',
        '-c',
        `import sys, json
from pathlib import Path
sys.path.insert(0, sys.argv[1])
from sources.osm import BBOX, TILE, tiles
out = Path(sys.argv[2]) / "data/sources/osm"
(out / "tiles").mkdir(parents=True)
for b in tiles(BBOX["BY"], TILE):
    (out / "tiles" / f"BY_{b[0]:.1f}_{b[1]:.1f}.json").write_text('{"elements": []}')
(out / "pois.jsonl").write_text('{"id": "node/1"}\\n')
(out / "fetched_at.json").write_text(json.dumps({"source_kind": "geofabrik-pbf", "counts": {"BY": {}, "PL": {}}}))`,
        DIR,
        home,
      ]);
      expect(seed.stderr).toBe('');
      const res = runCli('python3', ['-I', path.join(DIR, 'sources/osm.py'), '--ai-home', home, '--countries', 'BY', '--offline']);
      expect(res.status).toBe(1);
      expect(res.stderr).toContain('kept as is');
      expect(fs.readFileSync(path.join(home, 'data/sources/osm/pois.jsonl'), 'utf8')).toBe('{"id": "node/1"}\n');
    } finally {
      removeDir(home);
    }
  });
});
