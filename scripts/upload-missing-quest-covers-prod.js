#!/usr/bin/env node
/**
 * Upload only missing quest covers to production.
 *
 * Safety rule: before every PATCH, fetch the quest catalog and skip the quest
 * when cover_url is already present. This script never updates existing covers.
 *
 * Usage:
 *   node scripts/upload-missing-quest-covers-prod.js --dry-run --api-url=https://metravel.by
 *   node scripts/upload-missing-quest-covers-prod.js --api-url=https://metravel.by --token=YOUR_TOKEN
 *
 * You can also pass the token through QUEST_UPLOAD_TOKEN to keep it out of shell history.
 */

const fs = require('fs');
const path = require('path');

const args = process.argv.slice(2);
const isDryRun = args.includes('--dry-run');
const apiUrlArg = args.find((arg) => arg.startsWith('--api-url='));
const tokenArg = args.find((arg) => arg.startsWith('--token='));
const onlyQuestIdArg = args.find((arg) => arg.startsWith('--quest-id='));

const API_BASE = apiUrlArg ? apiUrlArg.split('=').slice(1).join('=').replace(/\/+$/, '') : 'https://metravel.by';
const TOKEN = tokenArg ? tokenArg.split('=').slice(1).join('=') : process.env.QUEST_UPLOAD_TOKEN || null;
const ONLY_QUEST_ID = onlyQuestIdArg ? onlyQuestIdArg.split('=').slice(1).join('=').trim() : null;
const ASSETS_DIR = path.resolve(__dirname, '..', 'assets', 'quests');

const QUEST_COVERS = [
  { quest_id: 'oshmyany-crossroads', assetsDir: 'oshmyanyCrossroads', cover: 'cover.png' },
  { quest_id: 'grodno-royal', assetsDir: 'grodnoRoyal', cover: 'cover.png' },
  { quest_id: 'brest-fortress', assetsDir: 'brestFortress', cover: 'cover.png' },
  { quest_id: 'vitebsk-chagall', assetsDir: 'vitebskChagall', cover: 'cover.png' },
  { quest_id: 'mogilev-stargazer', assetsDir: 'mogilevStargazer', cover: 'cover.png' },
  { quest_id: 'lida-castle', assetsDir: 'lidaCastle', cover: 'cover.png' },
  { quest_id: 'mir-castle', assetsDir: 'mirCastle', cover: 'cover.png' },
  { quest_id: 'nesvizh-radziwill', assetsDir: 'nesvizhRadziwill', cover: 'cover.png' },
  { quest_id: 'polotsk-ancient', assetsDir: 'polotskAncient', cover: 'cover.png' },
  { quest_id: 'gomel-palace', assetsDir: 'gomelPalace', cover: 'cover.png' },
  { quest_id: 'kossovo-ruzhany-palaces', assetsDir: 'kossovoRuzhanyPalaces', cover: 'cover.png' },
  { quest_id: 'minsk-loshitsa', assetsDir: 'minskLoshitsa', cover: 'cover.png' },
  { quest_id: 'minsk-traktorny', assetsDir: 'minskTraktorny', cover: 'cover.png' },
  { quest_id: 'minsk-dvoriki', assetsDir: 'minskDvoriki', cover: 'cover.png' },
  { quest_id: 'minsk-cipher', assetsDir: 'minskCipher', cover: 'cover.png' },
  { quest_id: 'krakow-kazimierz', assetsDir: 'krakowKazimierz', cover: 'cover.png' },
  { quest_id: 'krakow-podgorze', assetsDir: 'krakowPodgorze', cover: 'cover.png' },
  { quest_id: 'krakow-nowahuta', assetsDir: 'krakowNowaHuta', cover: 'cover.png' },
  { quest_id: 'wroclaw-gnomes', assetsDir: 'wroclawGnomes', cover: 'cover.png' },
  { quest_id: 'gdansk-amber', assetsDir: 'gdanskAmber', cover: 'cover.png' },
  { quest_id: 'poznan-goats', assetsDir: 'poznanGoats', cover: 'cover.png' },
  { quest_id: 'torun-copernicus', assetsDir: 'torunCopernicus', cover: 'cover.png' },
  { quest_id: 'lublin-old-town', assetsDir: 'lublinOldTown', cover: 'cover.png' },
  { quest_id: 'bialystok-zamenhof', assetsDir: 'bialystokZamenhof', cover: 'cover.png' },
  { quest_id: 'kaunas-capital', assetsDir: 'kaunasCapital', cover: 'cover.png' },
  { quest_id: 'pinsk-polesie', assetsDir: 'pinskPolesie', cover: 'cover.png' },
  { quest_id: 'tbilisi-warm-city', assetsDir: 'tbilisiWarmCity', cover: 'cover.png' },
  { quest_id: 'istanbul-empires', assetsDir: 'istanbulEmpires', cover: 'cover.png' },
  { quest_id: 'novogrudok-crown', assetsDir: 'novogrudokCrown', cover: 'cover.png' },
  { quest_id: 'batumi-golden-fleece', assetsDir: 'batumiGoldenFleece', cover: 'cover.png' },
  { quest_id: 'bobruisk-beaver-odessa', assetsDir: 'bobruiskBeaverOdessa', cover: 'cover.png' },
  { quest_id: 'budapest-two-cities', assetsDir: 'budapestTwoCities', cover: 'cover.png' },
  { quest_id: 'kutaisi-golden-age', assetsDir: 'kutaisiGoldenAge', cover: 'cover.png' },
  { quest_id: 'antalya-kaleici', assetsDir: 'antalyaKaleici', cover: 'cover.png' },
  { quest_id: 'istanbul-galata', assetsDir: 'istanbulGalata', cover: 'cover.png' },
  { quest_id: 'vienna-imperial-secrets', assetsDir: 'viennaSecrets', cover: 'cover.jpg' },
];

function getMime(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  return {
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.webp': 'image/webp',
  }[ext] || 'application/octet-stream';
}

function sizeMB(filePath) {
  return (fs.statSync(filePath).size / 1048576).toFixed(2);
}

function authHeaders() {
  return TOKEN ? { Authorization: `Token ${TOKEN}` } : {};
}

async function fetchQuestCatalog() {
  const quests = [];
  let url = `${API_BASE}/api/quests/`;
  for (let guard = 0; guard < 50 && url; guard += 1) {
    const response = await fetch(url, {
      headers: authHeaders(),
    });
    if (!response.ok) {
      const text = await response.text();
      throw new Error(`GET quest catalog: HTTP ${response.status}: ${text.substring(0, 200)}`);
    }
    const payload = await response.json();
    const pageQuests = Array.isArray(payload) ? payload : payload.results || payload.data || [];
    quests.push(...pageQuests);
    const next = Array.isArray(payload) ? null : payload.next_page_url || payload.next || null;
    url = next ? new URL(next, API_BASE).toString() : null;
  }
  return new Map(quests.map((quest) => [quest.quest_id, quest]));
}

async function uploadCover(questDbId, coverPath) {
  const buf = fs.readFileSync(coverPath);
  const form = new FormData();
  form.append('cover_image', new File([buf], path.basename(coverPath), { type: getMime(coverPath) }));

  const response = await fetch(`${API_BASE}/api/quests/${questDbId}/`, {
    method: 'PATCH',
    headers: authHeaders(),
    body: form,
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`PATCH quest ${questDbId}: HTTP ${response.status}: ${text.substring(0, 200)}`);
  }
  return response.json();
}

async function main() {
  const selected = ONLY_QUEST_ID
    ? QUEST_COVERS.filter((quest) => quest.quest_id === ONLY_QUEST_ID)
    : QUEST_COVERS;

  if (ONLY_QUEST_ID && selected.length === 0) {
    throw new Error(`Unknown quest id: ${ONLY_QUEST_ID}`);
  }

  console.log(`Upload missing quest covers -> ${API_BASE} (${isDryRun ? 'DRY RUN' : 'LIVE'})`);
  console.log(`Auth token: ${TOKEN ? 'present' : 'missing'}`);

  const questCatalog = await fetchQuestCatalog();

  for (const quest of selected) {
    const coverPath = path.join(ASSETS_DIR, quest.assetsDir, quest.cover);
    console.log(`\n${quest.quest_id}`);

    if (!fs.existsSync(coverPath)) {
      console.log(`  skip: local file is missing (${coverPath})`);
      continue;
    }

    const productionQuest = questCatalog.get(quest.quest_id);
    if (!productionQuest?.id) {
      console.log('  skip: production quest is missing from /api/quests/');
      continue;
    }
    if (productionQuest.cover_url) {
      console.log('  skip: production cover_url already exists');
      continue;
    }

    if (isDryRun) {
      console.log(`  [DRY] cover ${quest.cover} (${sizeMB(coverPath)} MB) -> PATCH /api/quests/${productionQuest.id}/`);
      continue;
    }

    await uploadCover(productionQuest.id, coverPath);
    console.log(`  uploaded cover (${sizeMB(coverPath)} MB)`);
  }

  console.log('\nDone');
}

main().catch((error) => {
  console.error('Fatal:', error.message);
  process.exit(1);
});
