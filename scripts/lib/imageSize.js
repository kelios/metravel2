/**
 * Размеры кадра из заголовка файла — общий ридер для всех `scripts/` (#2002).
 *
 * Зовут её гейт обложек квестов (`./questCoverAspect`) и iOS-гарды: листинг
 * App Store, релизный конфиг и аудит собранного архива. Раньше у каждого гарда
 * была своя приватная копия чтения IHDR, и правку формата пришлось бы вносить
 * в четыре места.
 *
 * Модуль без внешних зависимостей и на CommonJS: ради ширины и высоты тянуть
 * `sharp`/`jimp` незачем, а скриншот App Store 1290×2796 весит мегабайты —
 * поэтому с диска читается только начало файла.
 */

const fs = require('fs');

/** Сколько байт заголовка хватает всем поддерживаемым форматам. */
const HEADER_BYTES = 64 * 1024;

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

/** Сигнатура и целый чанк IHDR: длина, тип, 13 байт данных и CRC. */
const PNG_MIN_BYTES = 33;

function readHeader(filePath) {
  const fd = fs.openSync(filePath, 'r');
  try {
    const buf = Buffer.alloc(HEADER_BYTES);
    const read = fs.readSync(fd, buf, 0, HEADER_BYTES, 0);
    return buf.subarray(0, read);
  } finally {
    fs.closeSync(fd);
  }
}

/**
 * Поля IHDR: размеры и тип цвета (`colorType` 4 и 6 — кадр с альфа-каналом).
 * `null` — не PNG или IHDR не лежит в буфере целиком.
 *
 * Чанки перебираются, а не читаются по смещениям 16/20: Xcode пережимает PNG
 * бандла в Apple CgBI, и у `AppIcon60x60@2x.png` настоящей сборки первым идёт
 * чанк `CgBI`, IHDR — только вторым. Тип чанка сверяется явно: иначе «PNG» в
 * первых байтах чужого формата дал бы выдуманные размеры.
 */
function pngHeader(buf) {
  if (buf.length < PNG_MIN_BYTES || !buf.subarray(0, 8).equals(PNG_SIGNATURE)) {
    return null;
  }
  let offset = 8;
  while (offset + 12 <= buf.length) {
    const chunkLength = buf.readUInt32BE(offset);
    const chunkType = buf.toString('ascii', offset + 4, offset + 8);
    const chunkEnd = offset + 12 + chunkLength;
    if (chunkEnd > buf.length) return null;
    if (chunkType === 'IHDR' && chunkLength >= 13) {
      return {
        width: buf.readUInt32BE(offset + 8),
        height: buf.readUInt32BE(offset + 12),
        colorType: buf[offset + 17],
      };
    }
    offset = chunkEnd;
  }
  return null;
}

function pngSize(buf) {
  const header = pngHeader(buf);
  return header && { width: header.width, height: header.height };
}

function jpegSize(buf) {
  if (buf.length < 4 || buf[0] !== 0xff || buf[1] !== 0xd8) return null;
  let offset = 2;
  while (offset + 9 < buf.length) {
    if (buf[offset] !== 0xff) {
      offset += 1;
      continue;
    }
    const marker = buf[offset + 1];
    // SOF0..SOF15 несут размеры; SOF4/SOF8/SOF12 — не кадровые маркеры.
    const isFrameHeader =
      marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc;
    if (isFrameHeader) {
      return { height: buf.readUInt16BE(offset + 5), width: buf.readUInt16BE(offset + 7) };
    }
    if (marker === 0xd8 || (marker >= 0xd0 && marker <= 0xd9)) {
      offset += 2;
      continue;
    }
    offset += 2 + buf.readUInt16BE(offset + 2);
  }
  return null;
}

function webpSize(buf) {
  if (buf.length < 30) return null;
  if (buf.subarray(0, 4).toString('latin1') !== 'RIFF') return null;
  if (buf.subarray(8, 12).toString('latin1') !== 'WEBP') return null;
  const kind = buf.subarray(12, 16).toString('latin1');
  if (kind === 'VP8X') {
    // Три байта на сторону, little-endian, значение хранится как «минус один».
    const width = 1 + (buf[24] | (buf[25] << 8) | (buf[26] << 16));
    const height = 1 + (buf[27] | (buf[28] << 8) | (buf[29] << 16));
    return { width, height };
  }
  if (kind === 'VP8 ') {
    return { width: buf.readUInt16LE(26) & 0x3fff, height: buf.readUInt16LE(28) & 0x3fff };
  }
  if (kind === 'VP8L') {
    const bits = buf.readUInt32LE(21);
    return { width: 1 + (bits & 0x3fff), height: 1 + ((bits >> 14) & 0x3fff) };
  }
  return null;
}

/** Размеры PNG из заголовка файла. `null` — не PNG: другой формат не подменяет его. */
function readPngSize(filePath) {
  return pngSize(readHeader(filePath));
}

/** Размеры кадра PNG/WEBP/JPEG из заголовка файла. `null`, если формат не распознан. */
function readImageSize(filePath) {
  const buf = readHeader(filePath);
  return pngSize(buf) || webpSize(buf) || jpegSize(buf);
}

module.exports = {
  pngHeader,
  readImageSize,
  readPngSize,
};
