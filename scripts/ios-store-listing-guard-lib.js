'use strict';

const fs = require('fs');
const path = require('path');

const LISTING_PATH = path.join('docs', 'IOS_STORE_LISTING.md');

// App Store Connect localizations for MeTravel. BE отсутствует в списке локалей
// Apple, поэтому белорусская секция документа — справочная, не выгружаемая.
const ASC_LOCALES = ['RU', 'UK', 'PL', 'EN'];
const REFERENCE_LOCALES = ['BE'];

// Лимиты App Store Connect (символы, не байты).
const FIELD_LIMITS = {
  name: 30,
  subtitle: 30,
  promotional: 170,
  description: 4000,
  keywords: 100,
};

const REQUIRED_FIELDS = ['name', 'subtitle', 'promotional', 'description', 'keywords'];

const FIELD_ALIASES = [
  [/^name\b/i, 'name'],
  [/^subtitle\b/i, 'subtitle'],
  [/^promotional text\b/i, 'promotional'],
  [/^description\b/i, 'description'],
  [/^keywords\b/i, 'keywords'],
];

const REQUIRED_SERVICE_FIELDS = [
  [/^-\s*Category:/im, 'Category'],
  [/^-\s*Copyright:/im, 'Copyright'],
  [/^-\s*Support URL:/im, 'Support URL'],
  [/^-\s*Privacy URL:/im, 'Privacy URL'],
  [/^-\s*Marketing URL:/im, 'Marketing URL'],
  [/^-\s*Age rating:/im, 'Age rating'],
  [/^-\s*Price:/im, 'Price'],
  [/^-\s*Encryption:/im, 'Encryption'],
];

const PLACEHOLDER_PATTERNS = [
  /\bTODO\b/i,
  /\bTBD\b/i,
  /\bFIXME\b/i,
  /\bXXX+\b/,
  /lorem ipsum/i,
  /\bplaceholder\b/i,
];

// Секреты в карточку не попадают: демо-пароль живёт только в защищённых полях ASC.
const SECRET_PATTERNS = [
  [/(?:password|пароль|passcode)\s*[:=]\s*\S+/i, 'credential value'],
  [/\bTeam ID\s*[:=]\s*[A-Z0-9]{10}\b/i, 'Team ID'],
  [/\bUDID\s*[:=]\s*[0-9A-Fa-f-]{20,}/, 'UDID'],
  [/-----BEGIN [A-Z ]*PRIVATE KEY-----/, 'private key'],
];

// Слоты загрузки скриншотов App Store Connect (портрет). Обязательные наборы
// версии 1 — iPhone 6.9" и, для universal-сборки, iPad 13"; у слота iPad 13"
// две принимаемые пары размеров. 6.5" остаётся отдельным необязательным слотом:
// его кадры принимаем, но в обязательный набор не засчитываем. Размеры вне
// таблицы (например 1206×2622 или 1179×2556 с iPhone 16/15) ASC на загрузке
// отклоняет — их гуард обязан ловить до попытки выгрузки.
const SCREENSHOT_SIZES = [
  { label: 'iPhone 6.9"', width: 1290, height: 2796, family: 'iphone', required: true },
  { label: 'iPhone 6.9"', width: 1320, height: 2868, family: 'iphone', required: true },
  { label: 'iPhone 6.5"', width: 1242, height: 2688, family: 'iphone', required: false },
  { label: 'iPhone 6.5"', width: 1284, height: 2778, family: 'iphone', required: false },
  { label: 'iPad 13"', width: 2064, height: 2752, family: 'ipad', required: true },
  { label: 'iPad 13"', width: 2048, height: 2732, family: 'ipad', required: true },
];

const MIN_SCREENSHOTS_PER_FAMILY = 3;

function charLength(value) {
  return Array.from(value).length;
}

function splitSections(markdown) {
  const sections = new Map();
  const lines = markdown.split('\n');
  let current = null;
  let buffer = [];
  for (const line of lines) {
    const heading = /^##\s+(.+)$/.exec(line);
    if (heading) {
      if (current) sections.set(current, buffer.join('\n'));
      current = heading[1].trim();
      buffer = [];
      continue;
    }
    if (current) buffer.push(line);
  }
  if (current) sections.set(current, buffer.join('\n'));
  return sections;
}

function resolveFieldName(label) {
  for (const [pattern, field] of FIELD_ALIASES) {
    if (pattern.test(label)) return field;
  }
  return null;
}

// Значение поля идёт либо inline после `**Label:**`, либо ближайшим fenced-блоком.
function parseFields(sectionBody) {
  const fields = {};
  const lines = sectionBody.split('\n');
  for (let index = 0; index < lines.length; index += 1) {
    const match = /^\*\*([^*]+?)\s*:\*\*\s*(.*)$/.exec(lines[index]);
    if (!match) continue;
    const field = resolveFieldName(match[1].trim());
    if (!field || fields[field] !== undefined) continue;

    const inline = match[2].trim().replace(/^`|`$/g, '').trim();
    if (inline) {
      fields[field] = inline;
      continue;
    }
    let cursor = index + 1;
    while (cursor < lines.length && lines[cursor].trim() === '') cursor += 1;
    if (lines[cursor] === undefined || !lines[cursor].startsWith('```')) continue;
    const block = [];
    cursor += 1;
    while (cursor < lines.length && !lines[cursor].startsWith('```')) {
      block.push(lines[cursor]);
      cursor += 1;
    }
    fields[field] = block.join('\n').trim();
  }
  return fields;
}

// Заголовок несёт локаль первым токеном: `EN`, `EN-US` и `BE — справка` дают
// одну и ту же локаль ASC.
function localeOf(heading) {
  const token = heading.split(/[\s—-]/)[0].trim().toUpperCase();
  return ASC_LOCALES.includes(token) || REFERENCE_LOCALES.includes(token) ? token : null;
}

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

// Скриншот 1290×2796 весит мегабайты, поэтому читаем только заголовок. IHDR по
// спецификации PNG обязан быть первым чанком, но тип чанка проверяем явно:
// иначе «PNG» в первых байтах чужого формата дал бы выдуманные размеры.
function readPngSize(file) {
  const header = Buffer.alloc(24);
  const handle = fs.openSync(file, 'r');
  try {
    const read = fs.readSync(handle, header, 0, 24, 0);
    if (read < 24) return null;
    if (!header.subarray(0, 8).equals(PNG_SIGNATURE)) return null;
    if (header.toString('ascii', 12, 16) !== 'IHDR') return null;
    return { width: header.readUInt32BE(16), height: header.readUInt32BE(20) };
  } finally {
    fs.closeSync(handle);
  }
}

// Подсказка для отчёта: какой слот и какие размеры закрывают обязательный набор.
function requiredSlotHint(family) {
  const sizes = SCREENSHOT_SIZES.filter((size) => size.family === family && size.required);
  if (!sizes.length) return family;
  const dimensions = sizes.map((size) => `${size.width}×${size.height}`).join(', ');
  return `${sizes[0].label}: ${dimensions}`;
}

function matchScreenshotSize(width, height) {
  return SCREENSHOT_SIZES.find(
    (size) =>
      (size.width === width && size.height === height) ||
      (size.width === height && size.height === width),
  );
}

function validateLocaleSection(locale, fields, errors) {
  const isReference = REFERENCE_LOCALES.includes(locale);
  for (const field of REQUIRED_FIELDS) {
    const value = fields[field];
    if (value === undefined || value === '') {
      if (!isReference) {
        errors.push({ code: 'STORE_FIELD_MISSING', detail: `${locale}: нет поля ${field}` });
      }
      continue;
    }
    const limit = FIELD_LIMITS[field];
    const length = charLength(value);
    if (length > limit) {
      errors.push({
        code: 'STORE_FIELD_TOO_LONG',
        detail: `${locale}: ${field} — ${length} символов при лимите ${limit}`,
      });
    }
  }

  const keywords = fields.keywords;
  if (keywords) {
    if (/,\s/.test(keywords)) {
      errors.push({
        code: 'STORE_KEYWORDS_FORMAT',
        detail: `${locale}: пробел после запятой в keywords — Apple считает его символом`,
      });
    }
    const items = keywords.split(',').map((item) => item.trim().toLowerCase());
    if (items.some((item) => item === '')) {
      errors.push({ code: 'STORE_KEYWORDS_FORMAT', detail: `${locale}: пустой keyword` });
    }
    const duplicates = items.filter((item, index) => item !== '' && items.indexOf(item) !== index);
    if (duplicates.length) {
      errors.push({
        code: 'STORE_KEYWORDS_FORMAT',
        detail: `${locale}: дубли в keywords — ${[...new Set(duplicates)].join(', ')}`,
      });
    }
  }
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Голый `\b9\b` ловится о `iPhone 6.9"` в этом же файле, то есть проверка
// buildNumber проходила бы даже без единого упоминания билда. Требуем номер
// рядом с меткой: `buildNumber` 9, build 9, билд(а) 9.
function mentionsBuildNumber(markdown, buildNumber) {
  const value = escapeRegExp(buildNumber);
  return [
    new RegExp('buildNumber`?\\s*(?:[:=]|→)?\\s*' + value + '\\b', 'i'),
    new RegExp('\\bbuild\\s+' + value + '\\b', 'i'),
    new RegExp('\\bбилд[аеу]?\\s+' + value + '\\b', 'i'),
  ].some((pattern) => pattern.test(markdown));
}

function validateVersion(rootDir, markdown, errors) {
  const appJsonPath = path.join(rootDir, 'app.json');
  if (!fs.existsSync(appJsonPath)) return;
  const expo = JSON.parse(fs.readFileSync(appJsonPath, 'utf8')).expo || {};
  const version = expo.version;
  const buildNumber = String((expo.ios || {}).buildNumber ?? '');
  if (version && !markdown.includes(version)) {
    errors.push({
      code: 'STORE_VERSION_MISMATCH',
      detail: `в карточке нет версии ${version} из app.json`,
    });
  }
  if (buildNumber && !mentionsBuildNumber(markdown, buildNumber)) {
    errors.push({
      code: 'STORE_VERSION_MISMATCH',
      detail: `в карточке нет buildNumber ${buildNumber} из app.json`,
    });
  }
}

function requiredScreenshotFamilies(rootDir) {
  const families = ['iphone'];
  const appJsonPath = path.join(rootDir, 'app.json');
  if (!fs.existsSync(appJsonPath)) return families;
  const expo = JSON.parse(fs.readFileSync(appJsonPath, 'utf8')).expo || {};
  // supportsTablet делает сборку universal: ASC требует отдельный набор iPad.
  if ((expo.ios || {}).supportsTablet) families.push('ipad');
  return families;
}

function validateScreenshots(rootDir, screenshotsDir, errors) {
  const absolute = path.isAbsolute(screenshotsDir)
    ? screenshotsDir
    : path.join(rootDir, screenshotsDir);
  if (!fs.existsSync(absolute)) {
    errors.push({
      code: 'STORE_SCREENSHOT_DIR_MISSING',
      detail: `нет каталога скриншотов ${screenshotsDir}`,
    });
    return;
  }

  const counts = new Map();
  const files = fs
    .readdirSync(absolute, { withFileTypes: true })
    .filter((entry) => entry.isFile() && /\.png$/i.test(entry.name))
    .map((entry) => entry.name)
    .sort();

  for (const name of files) {
    const size = readPngSize(path.join(absolute, name));
    if (!size) {
      errors.push({ code: 'STORE_SCREENSHOT_SIZE', detail: `${name}: не PNG` });
      continue;
    }
    const matched = matchScreenshotSize(size.width, size.height);
    if (!matched) {
      errors.push({
        code: 'STORE_SCREENSHOT_SIZE',
        detail: `${name}: ${size.width}x${size.height} — App Store Connect такой размер не принимает`,
      });
      continue;
    }
    // Необязательный слот (6.5") ASC принимает, но обязательный набор им не закрыть.
    if (!matched.required) continue;
    counts.set(matched.family, (counts.get(matched.family) || 0) + 1);
  }

  for (const family of requiredScreenshotFamilies(rootDir)) {
    const count = counts.get(family) || 0;
    if (count < MIN_SCREENSHOTS_PER_FAMILY) {
      errors.push({
        code: 'STORE_SCREENSHOT_SET_INCOMPLETE',
        detail: `${family}: ${count} скриншотов обязательного размера (${requiredSlotHint(family)}) при минимуме ${MIN_SCREENSHOTS_PER_FAMILY}`,
      });
    }
  }
}

function validateStoreListing(rootDir, options = {}) {
  const errors = [];
  const listingPath = path.join(rootDir, LISTING_PATH);
  if (!fs.existsSync(listingPath)) {
    errors.push({ code: 'STORE_LISTING_MISSING', detail: `нет ${LISTING_PATH}` });
    return errors;
  }

  const markdown = fs.readFileSync(listingPath, 'utf8');
  const sections = splitSections(markdown);

  const seen = new Set();
  for (const [heading, body] of sections) {
    const locale = localeOf(heading);
    if (!locale) continue;
    seen.add(locale);
    validateLocaleSection(locale, parseFields(body), errors);
  }
  for (const locale of ASC_LOCALES) {
    if (!seen.has(locale)) {
      errors.push({ code: 'STORE_LOCALE_MISSING', detail: `нет секции локали ${locale}` });
    }
  }

  for (const [pattern, label] of REQUIRED_SERVICE_FIELDS) {
    if (!pattern.test(markdown)) {
      errors.push({ code: 'STORE_SERVICE_FIELD_MISSING', detail: `нет служебного поля ${label}` });
    }
  }

  for (const pattern of PLACEHOLDER_PATTERNS) {
    const match = pattern.exec(markdown);
    if (match) {
      errors.push({ code: 'STORE_PLACEHOLDER', detail: `заглушка в карточке: ${match[0]}` });
    }
  }
  for (const [pattern, label] of SECRET_PATTERNS) {
    if (pattern.test(markdown)) {
      errors.push({ code: 'STORE_SECRET_LEAK', detail: `в карточке возможен ${label}` });
    }
  }

  validateVersion(rootDir, markdown, errors);
  if (options.screenshotsDir) validateScreenshots(rootDir, options.screenshotsDir, errors);

  return errors;
}

module.exports = {
  ASC_LOCALES,
  FIELD_LIMITS,
  LISTING_PATH,
  MIN_SCREENSHOTS_PER_FAMILY,
  SCREENSHOT_SIZES,
  validateStoreListing,
};
