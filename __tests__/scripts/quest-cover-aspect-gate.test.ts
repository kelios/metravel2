import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import zlib from 'node:zlib';

import {
  MAX_COVER_ASPECT,
  MIN_COVER_ASPECT,
  catalogLetterboxShare,
  describeQuestCoverVerdict,
  inspectQuestCover,
  readImageSize,
  assertQuestCoverAspect,
} from '../../scripts/lib/questCoverAspect';

/**
 * #1987: партия из 30 квадратных обложек прошла весь пайплайн заливки молча и
 * отдала 31.6% ширины карточки каталога под плоскую заливку. Гейт обязан
 * ловить такой кадр ещё до PATCH на прод, а инвариант ниже — не давать
 * квадрату снова лечь в `cover.png` любого каталога `assets/quests`.
 */

const REPO_ROOT = process.cwd();

/** Минимальный валидный PNG заданного размера: нужен только заголовок IHDR. */
const pngFixture = (width: number, height: number): Buffer => {
  const chunk = (type: string, data: Buffer): Buffer => {
    const length = Buffer.alloc(4);
    length.writeUInt32BE(data.length, 0);
    const body = Buffer.concat([Buffer.from(type, 'latin1'), data]);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(zlib.crc32 ? zlib.crc32(body) : 0, 0);
    return Buffer.concat([length, body, crc]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
  ]);
};

// Без дженерика в сигнатуре: пресет `jest-expo` парсит `.ts` как TSX, и
// `<T,>` там читается открывающим JSX-тегом — файл разваливается целиком.
function withTempCover(width: number, height: number, run: (file: string) => void): void {
  const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'quest-cover-')), 'cover.png');
  fs.writeFileSync(file, pngFixture(width, height));
  try {
    run(file);
  } finally {
    fs.rmSync(path.dirname(file), { recursive: true, force: true });
  }
}

describe('гейт пропорции обложки квеста', () => {
  it('читает размеры PNG из заголовка без внешних зависимостей', () => {
    withTempCover(1536, 1024, (file) => {
      expect(readImageSize(file)).toEqual({ width: 1536, height: 1024 });
    });
  });

  it('отбивает квадратную обложку — ровно тот кадр, что вызвал #1987', () => {
    withTempCover(1254, 1254, (file) => {
      const verdict = inspectQuestCover(file);
      expect(verdict.ok).toBe(false);
      expect(verdict.reason).toBe('too-narrow');
      expect(describeQuestCoverVerdict(verdict)).toContain('31.6%');
      expect(() => assertQuestCoverAspect(file)).toThrow(/пропорци/i);
    });
  });

  it('пропускает целевые 3:2 и историческую полосу 4:3…16:9', () => {
    for (const [width, height] of [
      [1536, 1024], // 3:2 — цель
      [1448, 1086], // 4:3 — исторический хвост
      [1672, 941], // 16:9 — исторический хвост
    ]) {
      withTempCover(width, height, (file) => {
        expect(inspectQuestCover(file).ok).toBe(true);
      });
    }
  });

  it('отбивает слишком широкий кадр', () => {
    withTempCover(2000, 1000, (file) => {
      const verdict = inspectQuestCover(file);
      expect(verdict.ok).toBe(false);
      expect(verdict.reason).toBe('too-wide');
    });
  });

  it('границы гейта покрывают ровно исторический набор обложек', () => {
    expect(MIN_COVER_ASPECT).toBeLessThanOrEqual(4 / 3);
    expect(MAX_COVER_ASPECT).toBeGreaterThanOrEqual(16 / 9);
    expect(MIN_COVER_ASPECT).toBeGreaterThan(1);
  });

  it('считает долю плоского поля так же, как её видно на карточке', () => {
    expect(catalogLetterboxShare(1)).toBeCloseTo(0.316, 3);
    expect(catalogLetterboxShare(1.5)).toBeCloseTo(0.026, 3);
    expect(catalogLetterboxShare(16 / 9)).toBeCloseTo(0.178, 3);
  });

  it('оба скрипта заливки зовут гейт до мутации прода', () => {
    for (const script of ['upload-quest-media.js', 'upload-missing-quest-covers-prod.js']) {
      const source = fs.readFileSync(path.join(REPO_ROOT, 'scripts', script), 'utf8');
      expect(source).toContain("require('./lib/questCoverAspect')");
      expect(source).toContain('assertQuestCoverAspect(coverPath)');
    }
  });

  it('ни одна обложка в assets/quests не нарушает гейт', () => {
    const assetsDir = path.join(REPO_ROOT, 'assets', 'quests');
    const offenders: string[] = [];
    for (const dir of fs.readdirSync(assetsDir)) {
      const cover = path.join(assetsDir, dir, 'cover.png');
      if (!fs.existsSync(cover)) continue;
      const verdict = inspectQuestCover(cover);
      if (!verdict.ok) offenders.push(`${dir}: ${describeQuestCoverVerdict(verdict)}`);
    }
    expect(offenders).toEqual([]);
  });
});
