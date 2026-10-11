#!/usr/bin/env node
/**
 * Скан запрещённых источников по Беларуси в контенте MeTravel: data-файлы
 * квестов, черновики и HTML статей, пакеты постов Instagram.
 *
 * Правило владельца 11.10.2026: ресурсы из перечня экстремистских материалов РБ
 * («Наша Ніва», «Зеркало»/TUT.BY, «Радыё Свабода», «Белсат», «Еврорадио»,
 * «Хартия'97» и подобные) не упоминаются и не цитируются ни в одном тексте
 * площадки. Список — `scripts/content-source-denylist.json`, один на все три
 * направления; до него правило жило ручным grep только в скилле квестов.
 *
 * Бытовое «зеркало» не ловится: шаблон берёт название только в кавычках или
 * доменом. Выход 1 при любом попадании.
 *
 *   node scripts/scan-content-sources.js scripts/minsk-quest-data.js
 *   node scripts/scan-content-sources.js .codex-temp/instagram/posts/<пакет>
 *   echo "<html статьи>" | node scripts/scan-content-sources.js -
 *   node scripts/scan-content-sources.js --json <пути…>
 */
const fs = require('fs');
const path = require('path');

const DENYLIST_PATH = path.join(__dirname, 'content-source-denylist.json');
const TEXT_EXTENSIONS = new Set(['.js', '.json', '.md', '.txt', '.html', '.htm', '.py', '.ts', '.tsx', '.yml', '.yaml']);

function loadPatterns(denylistPath = DENYLIST_PATH) {
  const { patterns } = JSON.parse(fs.readFileSync(denylistPath, 'utf8'));
  return patterns.map((p) => ({ ...p, re: new RegExp(p.regex, 'giu') }));
}

function scanText(text, patterns, source = '<text>') {
  const hits = [];
  const lines = String(text).split('\n');
  lines.forEach((line, index) => {
    for (const p of patterns) {
      p.re.lastIndex = 0;
      let m;
      while ((m = p.re.exec(line)) !== null) {
        hits.push({ source, line: index + 1, id: p.id, label: p.label, match: m[0] });
        if (m[0] === '') p.re.lastIndex += 1;
      }
    }
  });
  return hits;
}

function collectFiles(target) {
  const stat = fs.statSync(target);
  if (stat.isFile()) return [target];
  const out = [];
  for (const entry of fs.readdirSync(target, { withFileTypes: true })) {
    if (entry.name.startsWith('.') || entry.name === 'node_modules') continue;
    const full = path.join(target, entry.name);
    if (entry.isDirectory()) out.push(...collectFiles(full));
    else if (TEXT_EXTENSIONS.has(path.extname(entry.name).toLowerCase())) out.push(full);
  }
  return out;
}

function main(argv = process.argv.slice(2)) {
  const json = argv.includes('--json');
  const targets = argv.filter((a) => a !== '--json');
  if (targets.length === 0) {
    process.stderr.write('Usage: node scripts/scan-content-sources.js [--json] <file|dir|->...\n');
    return 2;
  }
  const patterns = loadPatterns();
  const hits = [];
  for (const target of targets) {
    if (target === '-') {
      hits.push(...scanText(fs.readFileSync(0, 'utf8'), patterns, '<stdin>'));
      continue;
    }
    for (const file of collectFiles(target)) {
      hits.push(...scanText(fs.readFileSync(file, 'utf8'), patterns, file));
    }
  }
  if (json) {
    process.stdout.write(`${JSON.stringify({ hits }, null, 2)}\n`);
  } else if (hits.length === 0) {
    process.stdout.write('content-sources: 0 попаданий\n');
  } else {
    for (const h of hits) process.stdout.write(`${h.source}:${h.line}  ${h.label}  «${h.match}»\n`);
    process.stdout.write(`content-sources: ${hits.length} попаданий — убрать упоминание, факт взять из книги/музея/госСМИ\n`);
  }
  return hits.length === 0 ? 0 : 1;
}

if (require.main === module) process.exit(main());

module.exports = { loadPatterns, scanText, collectFiles, main };
