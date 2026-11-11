import fs from 'fs';
import path from 'path';

/**
 * services/metravel-llm/model.json — единственный источник версии модели
 * ассистента (#3271): файл, sha256, размер, дата принятия, карточка и версия для
 * отката. Документы и конфигурация запуска по умолчанию сверяются с ним: при
 * замене модели правится манифест, а расхождение краснеет здесь.
 */
const ROOT = path.join(__dirname, '..', '..');
const read = (file: string): string => fs.readFileSync(path.join(ROOT, file), 'utf8');

type ModelEntry = { version: string; file: string; sha256: string; bytes: number };
type Manifest = ModelEntry & { accepted: string; task: number; previous: ModelEntry };

const MANIFEST_PATH = 'services/metravel-llm/model.json';
const README_PATH = 'services/metravel-llm/README.md';
const FEATURE_DOC_PATH = 'docs/features/ai-assistant.md';
const LAUNCH_PATH = '.claude/launch.json';

const manifest = JSON.parse(read(MANIFEST_PATH)) as Manifest;

/** Имена файлов модели в тексте: `metravel-llm-v7-Q4_K_M.gguf`, `metravel-llm-v5-rag-Q4_K_M.gguf`. */
const modelFiles = (text: string): string[] => [...new Set(text.match(/metravel-llm-v\d[\w.-]*?-Q4_K_M\.gguf/g) ?? [])];
/** Полные sha256 в тексте (сокращённые `2bb809db…a60f6` сюда не попадают). */
const fullHashes = (text: string): string[] => [...new Set(text.match(/(?<![0-9a-f])[0-9a-f]{64}(?![0-9a-f])/g) ?? [])];

/** Расхождения документа с манифестом; пустой список — документ сходится. */
export const manifestMismatches = (text: string, model: Manifest, { requireHash }: { requireHash: boolean }): string[] => {
  const problems: string[] = [];
  const allowedFiles = new Set([model.file, model.previous.file]);
  const allowedHashes = new Set([model.sha256, model.previous.sha256]);
  if (!text.includes(model.file)) problems.push(`нет имени файла ${model.file}`);
  if (requireHash && !text.includes(model.sha256)) problems.push(`нет sha256 ${model.sha256}`);
  for (const file of modelFiles(text)) if (!allowedFiles.has(file)) problems.push(`чужой файл модели ${file}`);
  for (const hash of fullHashes(text)) if (!allowedHashes.has(hash)) problems.push(`чужой sha256 ${hash}`);
  return problems;
};

describe('metravel-llm model manifest (#3271)', () => {
  const entries: [string, ModelEntry][] = [
    ['модель по умолчанию', manifest],
    ['версия для отката', manifest.previous],
  ];

  it.each(entries)('%s: версия, файл, sha256 и размер заданы по одному правилу', (_label, entry) => {
    expect(entry.version).toMatch(/^v\d[\w-]*$/);
    expect(entry.file).toBe(`metravel-llm-${entry.version}-Q4_K_M.gguf`);
    expect(entry.sha256).toMatch(/^[0-9a-f]{64}$/);
    expect(Number.isInteger(entry.bytes) && entry.bytes > 0).toBe(true);
  });

  it('дата принятия и карточка записаны, откат — другая версия', () => {
    expect(manifest.accepted).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(Number.isInteger(manifest.task) && manifest.task > 0).toBe(true);
    expect(manifest.previous.version).not.toBe(manifest.version);
    expect(manifest.previous.sha256).not.toBe(manifest.sha256);
  });

  it('README сервера модели называет файл и sha256 из манифеста и не называет других версий', () => {
    expect(manifestMismatches(read(README_PATH), manifest, { requireHash: true })).toEqual([]);
    expect(read(README_PATH)).toContain(`LLM_MODEL=${manifest.file}`);
  });

  it('документ ассистента запускает модель из манифеста', () => {
    expect(manifestMismatches(read(FEATURE_DOC_PATH), manifest, { requireHash: false })).toEqual([]);
  });

  it('конфигурация запуска «(default)» поднимает файл из манифеста', () => {
    const launch = JSON.parse(read(LAUNCH_PATH)) as { configurations: { name: string; runtimeArgs?: string[] }[] };
    const defaults = launch.configurations.filter((config) => /^Llama Server .*\(default\)$/.test(config.name));
    expect(defaults).toHaveLength(1);
    expect(defaults[0].name).toContain(` ${manifest.version} `);
    expect((defaults[0].runtimeArgs ?? []).some((arg) => arg.endsWith(`/${manifest.file}`))).toBe(true);
  });

  it('README не ссылается на файлы репозитория, которых нет', () => {
    const paths = [...read(README_PATH).matchAll(/`((?:scripts|__tests__|services|docs)\/[\w./-]+\.(?:sh|py|mjs|js|ts|json|md))(?=[`\s])/g)].map((match) => match[1]);
    expect(paths.length).toBeGreaterThan(0);
    expect([...new Set(paths)].filter((file) => !fs.existsSync(path.join(ROOT, file)))).toEqual([]);
  });

  it('расхождение краснеет: другой sha256 и другая версия файла в документе — находки', () => {
    const drifted = read(README_PATH)
      .replace(manifest.sha256, `${'0'.repeat(63)}1`)
      .replace(`LLM_MODEL=${manifest.file}`, 'LLM_MODEL=metravel-llm-v9-Q4_K_M.gguf');
    const problems = manifestMismatches(drifted, manifest, { requireHash: true });
    expect(problems).toEqual(expect.arrayContaining([
      `нет sha256 ${manifest.sha256}`,
      'чужой файл модели metravel-llm-v9-Q4_K_M.gguf',
      `чужой sha256 ${'0'.repeat(63)}1`,
    ]));
  });
});
