import fs from 'node:fs';
import path from 'node:path';

import { runNodeCli } from './cli-test-utils';

const ROOT = process.cwd();
const SCRIPT = path.join(ROOT, 'scripts/upload-quest-media.js');
let dir: string;

beforeEach(() => {
  fs.mkdirSync(path.join(ROOT, '.codex-temp'), { recursive: true });
  dir = fs.mkdtempSync(path.join(ROOT, '.codex-temp/quest-media-test-'));
  fs.mkdirSync(path.join(dir, 'scripts/lib'), { recursive: true });
  fs.copyFileSync(SCRIPT, path.join(dir, 'scripts/upload-quest-media.js'));
  fs.copyFileSync(path.join(ROOT, 'scripts/lib/questCoverAspect.js'), path.join(dir, 'scripts/lib/questCoverAspect.js'));
  // Только IHDR: операторский гейт читает размер, содержимое файла не декодирует.
  const png = Buffer.alloc(33);
  Buffer.from('89504e470d0a1a0a', 'hex').copy(png);
  png.write('IHDR', 12);
  png.writeUInt32BE(1536, 16);
  png.writeUInt32BE(1024, 20);
  for (const name of ['krakowDragon', 'pakocim']) {
    const assets = path.join(dir, 'assets/quests', name);
    fs.mkdirSync(assets, { recursive: true });
    fs.writeFileSync(path.join(assets, 'cover.png'), png);
  }
});

afterEach(() => {
  fs.rmSync(dir, { recursive: true, force: true });
});

function run(mode: string, args: string[] = []) {
  const preload = path.join(dir, 'fetch.cjs');
  // Подменяется только транспорт; запускается настоящий CLI, FormData и exit code.
  fs.writeFileSync(preload, `
    const fs = require('node:fs');
    const calls = [];
    const saved = new Map();
    const mode = ${JSON.stringify(mode)};
    process.on('exit', () => fs.writeFileSync(${JSON.stringify(path.join(dir, 'calls.json'))}, JSON.stringify(calls)));
    global.fetch = async (url, options = {}) => {
      const method = options.method || 'GET';
      const fields = options.body ? Array.from(options.body.keys()) : [];
      calls.push({ url, method, fields });
      const fail = (status) => ({ ok: false, status, text: async () => 'refused' });
      const ok = (data) => ({ ok: true, status: 200, json: async () => data });
      if (mode === 'bundle-fails') return fail(403);
      if (method === 'PATCH') {
        if (mode === 'patch-fails' && url.includes('/101/')) return fail(400);
        const id = url.includes('/101/') ? 101 : 102;
        if (fields.includes('cover_image') && mode !== 'ignored') saved.set(id, true);
        // Ответ PATCH намеренно не содержит cover_url — так устроен write serializer.
        return ok({ id, cover_image: '/stored.png' });
      }
      const id = url.includes('krakow-dragon') ? 101 : 102;
      if (saved.has(id) && mode === 'readback-fails') return fail(503);
      return ok({ id, cover_url: saved.has(id)
        ? (mode === 'empty' ? '' : '/new-' + id + '.webp')
        : '/old-' + id + '.webp', steps: [] });
    };
  `);
  const result = runNodeCli(['--require', preload, path.join(dir, 'scripts/upload-quest-media.js'),
    '--api-url=http://localhost:8000', ...args]);
  return { ...result, calls: JSON.parse(fs.readFileSync(path.join(dir, 'calls.json'), 'utf8')) };
}

it('отправляет cover_image и печатает успех только после повторного GET с новым cover_url', () => {
  const result = run('success');
  expect(result.status).toBe(0);
  expect(result.stdout.match(/✅ cover загружен/g)).toHaveLength(2);
  expect(result.calls.map((call: { method: string }) => call.method)).toEqual([
    'GET', 'PATCH', 'GET', 'GET', 'PATCH', 'GET',
  ]);
  expect(result.calls[1]).toEqual({
    url: 'http://localhost:8000/api/quests/101/', method: 'PATCH', fields: ['cover_image'],
  });
});

it.each(['ignored', 'empty', 'readback-fails'])('не выдаёт успех, когда PATCH 200, но чтение не подтверждает запись (%s)', (mode) => {
  const result = run(mode);
  expect(result.status).toBe(1);
  expect(result.stdout).not.toContain('✅ cover загружен');
  expect(result.stdout).not.toContain('альтернативный подход');
  expect(result.stderr).toContain('Не подтверждено загрузок: 2');
});

it('продолжает следующий квест после отказа PATCH, сохраняя ошибочный exit code', () => {
  const result = run('patch-fails');
  expect(result.status).toBe(1);
  expect(result.stdout.match(/✅ cover загружен/g)).toHaveLength(1);
  expect(result.stderr).toContain('HTTP 400');
  expect(result.calls.map((call: { method: string }) => call.method)).toEqual(['GET', 'PATCH', 'GET', 'PATCH', 'GET']);
});

it('возвращает ошибку при недоступности исходного bundle и не отправляет PATCH', () => {
  const result = run('bundle-fails');
  expect(result.status).toBe(1);
  expect(result.calls.every((call: { method: string }) => call.method === 'GET')).toBe(true);
  expect(result.stderr).toContain('HTTP 403');
});

it('явно отклоняет видео, постер и картинки шагов вместо PATCH неподдерживаемых полей', () => {
  const scriptPath = path.join(dir, 'scripts/upload-quest-media.js');
  fs.writeFileSync(scriptPath, fs.readFileSync(scriptPath, 'utf8')
    .replace('stepImages: {},', "stepImages: { first: '1.png' },")
    .replace('finalePoster: null,', "finalePoster: 'poster.png',"));
  for (const file of ['krakowDragon.mp4', '1.png', 'poster.png']) {
    fs.writeFileSync(path.join(dir, 'assets/quests/krakowDragon', file), 'fixture');
  }
  const result = run('success');
  expect(result.status).toBe(1);
  expect(result.stderr).toContain('/api/quest-finales/{id}/ с полем video');
  expect(result.stderr).toContain('/api/quest-finales/{id}/ с полем poster');
  expect(result.stderr).toContain('/api/quest-steps/{id}/ с полем image');
  expect(result.stderr).toContain('Не подтверждено загрузок: 3');
  expect(result.calls.filter((call: { method: string }) => call.method === 'PATCH')
    .every((call: { fields: string[] }) => call.fields.join() === 'cover_image')).toBe(true);
});

it('dry-run сохраняет инвентаризацию и не выполняет сетевых запросов', () => {
  const result = run('success', ['--dry-run']);
  expect(result.status).toBe(0);
  expect(result.calls).toEqual([]);
  expect(result.stdout).toContain('Режим: DRY RUN');
  expect(result.stdout).toContain('Файлов: 2');
  expect(result.stdout).toContain('1536');
});
