import fs from 'node:fs';
import path from 'node:path';

import { pngHeader, readImageSize, readPngSize } from '../../scripts/lib/imageSize';
import { makeTempDir } from './cli-test-utils';

/**
 * #2002: размеры кадра читает один модуль на гейт обложек квестов и три
 * iOS-гарда. Здесь закреплено то, на чём разошлись бы бывшие копии: иконка
 * из архива Xcode (CgBI перед IHDR), альфа-канал иконки App Store и то, что
 * скриншоты листинга принимаются только в PNG.
 */

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

// CRC ридер не сверяет, но место под него есть, как в настоящем файле.
const chunk = (type: string, data: Buffer): Buffer => {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  return Buffer.concat([length, Buffer.from(type, 'latin1'), data, Buffer.alloc(4)]);
};

const ihdr = (width: number, height: number, colorType: number): Buffer => {
  const data = Buffer.alloc(13);
  data.writeUInt32BE(width, 0);
  data.writeUInt32BE(height, 4);
  data[8] = 8;
  data[9] = colorType;
  return chunk('IHDR', data);
};

const png = (...chunks: Buffer[]): Buffer => Buffer.concat([PNG_SIGNATURE, ...chunks]);

// Так начинается `AppIcon60x60@2x.png` в настоящем архиве: Xcode пережимает PNG
// бандла, и чанк `CgBI` встаёт перед IHDR.
const CGBI = chunk('CgBI', Buffer.from('50002006', 'hex'));

const jpeg = (width: number, height: number): Buffer => {
  const app0 = Buffer.concat([
    Buffer.from([0xff, 0xe0, 0x00, 0x10]),
    Buffer.from('JFIF\0', 'latin1'),
    Buffer.alloc(9),
  ]);
  const sof0 = Buffer.alloc(19);
  sof0.writeUInt16BE(0xffc0, 0);
  sof0.writeUInt16BE(17, 2);
  sof0[4] = 8;
  sof0.writeUInt16BE(height, 5);
  sof0.writeUInt16BE(width, 7);
  sof0[9] = 3;
  return Buffer.concat([Buffer.from([0xff, 0xd8]), app0, sof0, Buffer.from([0xff, 0xd9])]);
};

const webp = (width: number, height: number): Buffer => {
  const buf = Buffer.alloc(30);
  buf.write('RIFF', 0, 'latin1');
  buf.writeUInt32LE(22, 4);
  buf.write('WEBP', 8, 'latin1');
  buf.write('VP8X', 12, 'latin1');
  buf.writeUInt32LE(10, 16);
  buf.writeUIntLE(width - 1, 24, 3);
  buf.writeUIntLE(height - 1, 27, 3);
  return buf;
};

let dir: string;

beforeAll(() => {
  dir = makeTempDir('image-size-');
});

afterAll(() => {
  fs.rmSync(dir, { recursive: true, force: true });
});

function writeImage(name: string, content: Buffer): string {
  const file = path.join(dir, name);
  fs.writeFileSync(file, content);
  return file;
}

describe('чтение размеров кадра из заголовка', () => {
  it('отдаёт размеры и тип цвета IHDR — релизный гард по нему ловит альфу иконки', () => {
    expect(pngHeader(png(ihdr(1024, 1024, 2)))).toEqual({ width: 1024, height: 1024, colorType: 2 });
    expect(pngHeader(png(ihdr(1024, 1024, 6)))?.colorType).toBe(6);
  });

  it('находит IHDR после чанка CgBI — иконку из архива Xcode', () => {
    const icon = png(CGBI, ihdr(120, 120, 6));
    expect(pngHeader(icon)).toEqual({ width: 120, height: 120, colorType: 6 });

    const file = writeImage('AppIcon60x60@2x.png', icon);
    expect(readPngSize(file)).toEqual({ width: 120, height: 120 });
    expect(readImageSize(file)).toEqual({ width: 120, height: 120 });
  });

  it('не выдумывает размеры по неполному или чужому заголовку', () => {
    const valid = png(ihdr(1536, 1024, 6));
    const foreignTail = Buffer.from(valid);
    foreignTail.write('\0\0\0\0', 4, 'latin1');
    const shortIhdr = Buffer.from(valid);
    shortIhdr.writeUInt32BE(0, 8);

    expect(pngHeader(valid.subarray(0, valid.length - 1))).toBeNull();
    expect(pngHeader(foreignTail)).toBeNull();
    expect(pngHeader(shortIhdr)).toBeNull();
    expect(readImageSize(writeImage('foreign-tail.png', foreignTail))).toBeNull();
  });

  it('скриншоты листинга — только PNG, обложки квестов — ещё WEBP и JPEG', () => {
    const cover = writeImage('cover.jpg', jpeg(1536, 1024));
    const webCover = writeImage('cover.webp', webp(1536, 1024));

    expect(readPngSize(cover)).toBeNull();
    expect(readPngSize(webCover)).toBeNull();
    expect(readImageSize(cover)).toEqual({ width: 1536, height: 1024 });
    expect(readImageSize(webCover)).toEqual({ width: 1536, height: 1024 });
  });
});
