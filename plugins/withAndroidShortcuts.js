// plugins/withAndroidShortcuts.js
// AND-20: Expo config plugin to add Android App Shortcuts.
// Long-press on app icon → «Поиск», «Карта», «Хочу поехать».
//
/* global module, require */
//
// This plugin:
// 1. Creates res/xml/shortcuts.xml with 3 static shortcuts
// 2. Writes the shortcut labels into res/values/strings.xml (ru, default) and
//    res/values-<locale>/strings.xml for the other app locales
// 3. Adds <meta-data> to AndroidManifest.xml referencing the shortcuts

const fs = require('fs');
const path = require('path');

const SHORTCUTS_XML = `<?xml version="1.0" encoding="utf-8"?>
<shortcuts xmlns:android="http://schemas.android.com/apk/res/android">
    <shortcut
        android:shortcutId="search"
        android:enabled="true"
        android:icon="@android:drawable/ic_menu_search"
        android:shortcutShortLabel="@string/shortcut_search_short"
        android:shortcutLongLabel="@string/shortcut_search_long">
        <intent
            android:action="android.intent.action.VIEW"
            android:targetPackage="by.metravel.app"
            android:targetClass="by.metravel.app.MainActivity"
            android:data="metravel:///search" />
        <categories android:name="android.shortcut.conversation" />
    </shortcut>
    <shortcut
        android:shortcutId="map"
        android:enabled="true"
        android:icon="@android:drawable/ic_menu_mapmode"
        android:shortcutShortLabel="@string/shortcut_map_short"
        android:shortcutLongLabel="@string/shortcut_map_long">
        <intent
            android:action="android.intent.action.VIEW"
            android:targetPackage="by.metravel.app"
            android:targetClass="by.metravel.app.MainActivity"
            android:data="metravel:///map" />
        <categories android:name="android.shortcut.conversation" />
    </shortcut>
    <shortcut
        android:shortcutId="favorites"
        android:enabled="true"
        android:icon="@android:drawable/btn_star_big_on"
        android:shortcutShortLabel="@string/shortcut_favorites_short"
        android:shortcutLongLabel="@string/shortcut_favorites_long">
        <intent
            android:action="android.intent.action.VIEW"
            android:targetPackage="by.metravel.app"
            android:targetClass="by.metravel.app.MainActivity"
            android:data="metravel:///favorites" />
        <categories android:name="android.shortcut.conversation" />
    </shortcut>
</shortcuts>`;

// Подписи ярлыков = названия экранов, на которые они ведут (#1747). До этого
// «Избранное» жило здесь захардкоженным по-русски для всех локалей, а экран
// /favorites во всём приложении уже назывался «Хочу поехать» (#1745).
//
// Источник истины — i18n: короткая подпись = `breadcrumb.<экран>` из
// `i18n/locales/<locale>/static/navigation_static.ts`, длинная у «Хочу поехать» —
// описание того же экрана, у поиска — подпись «Поиск маршрутов». Таблица ниже —
// зеркало, а не второй источник: config-плагин выполняется при prebuild как
// обычный CommonJS, и TS-модули i18n ему недоступны. Паритет держит
// `__tests__/config/android-shortcuts.test.ts`: переименовали экран в i18n —
// тест падает, пока не обновлена и эта таблица. Единственные строки без ключа
// в i18n — длинные подписи карты («Карта маршрутов»): ключа с таким текстом в
// приложении нет, переводы даны здесь.
//
// `ru` — default (`values/strings.xml`), остальные — `values-<locale>/strings.xml`.
//
// Ограничение статических ярлыков: лаунчер резолвит `@string` по локали
// УСТРОЙСТВА, а язык приложения выбирается внутри него (`i18n/LocaleProvider`)
// и системную локаль может не совпадать. Пользователь с устройством на русском и
// приложением на английском увидит «Хочу поехать» на ярлыке и «I want to go» на
// экране. Полностью это лечат только динамические ярлыки
// (`ShortcutManagerCompat.setDynamicShortcuts` из рантайма) — вне этой правки.
// На приёмке язык переключать локалью устройства, а не переключателем в приложении.
const DEFAULT_LOCALE = 'ru';
const SHORTCUT_LABELS = {
  ru: {
    search: { short: 'Поиск', long: 'Поиск маршрутов' },
    map: { short: 'Карта', long: 'Карта маршрутов' },
    favorites: { short: 'Хочу поехать', long: 'Маршруты, куда вы хотите поехать' },
  },
  be: {
    search: { short: 'Пошук', long: 'Пошук маршрутаў' },
    map: { short: 'Карта', long: 'Карта маршрутаў' },
    favorites: { short: 'Хачу паехаць', long: 'Маршруты, куды вы хочаце паехаць' },
  },
  uk: {
    search: { short: 'Пошук', long: 'Пошук маршрутів' },
    map: { short: 'Карта', long: 'Карта маршрутів' },
    favorites: { short: 'Хочу поїхати', long: 'Маршрути, куди ви хочете поїхати' },
  },
  pl: {
    search: { short: 'Szukaj', long: 'Szukaj tras' },
    map: { short: 'Mapa', long: 'Mapa tras' },
    favorites: { short: 'Chcę iść', long: 'Trasy, którymi chcesz się udać' },
  },
  en: {
    search: { short: 'Search', long: 'Search routes' },
    map: { short: 'Map', long: 'Route map' },
    favorites: { short: 'I want to go', long: 'Routes where you want to go' },
  },
};

const SHORTCUT_STRING_LINE = /^[ \t]*<string name="shortcut_[a-z]+_(?:short|long)">.*<\/string>[ \t]*\r?\n?/gm;

const TOOLS_NAMESPACE = 'xmlns:tools="http://schemas.android.com/tools"';
const MISSING_TRANSLATION_IGNORE = 'tools:ignore="MissingTranslation"';

/**
 * Дефолтный `values/strings.xml` получает `tools:ignore="MissingTranslation"`.
 * Каталоги `values-<locale>/` несут только `shortcut_*`, а `app_name`,
 * `expo_runtime_version` и facebook-строки дефолтного набора в них не
 * переведены — для AGP-lint это MissingTranslation, а он FATAL и валит
 * `:app:lintVitalRelease` (то есть release-бандл), не трогая debug-сборку.
 * Lint репортит промах на объявлении в дефолтном файле, поэтому ставится именно
 * на его корень, а не в файлы локалей.
 */
function allowMissingTranslations(content) {
  const root = content.match(/<resources(\s[^>]*)?>/);
  if (!root) return content;
  if (/tools:ignore=/.test(root[0])) return content;
  const attrs = [];
  if (!/xmlns:tools=/.test(root[0])) attrs.push(TOOLS_NAMESPACE);
  attrs.push(MISSING_TRANSLATION_IGNORE);
  const opening = root[0].replace(/<resources/, `<resources ${attrs.join(' ')}`);
  return content.replace(root[0], opening);
}

/** Android string resource: апостроф и кавычки экранируются бэкслешем, XML-спецсимволы — сущностями. */
function escapeAndroidString(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '\\"')
    .replace(/'/g, "\\'");
}

function renderShortcutStrings(labels) {
  return Object.entries(labels)
    .flatMap(([id, { short, long }]) => [
      `    <string name="shortcut_${id}_short">${escapeAndroidString(short)}</string>`,
      `    <string name="shortcut_${id}_long">${escapeAndroidString(long)}</string>`,
    ])
    .join('\n');
}

/**
 * Пишет подписи в strings.xml каталога ресурсов. Старые `shortcut_*` строки
 * снимаются, а не пропускаются: прежняя проверка «уже есть shortcut_search_short
 * — ничего не трогать» оставляла в уже собранном `android/` устаревшее
 * «Избранное» навсегда. Отсутствующий файл (`values-<locale>/`) создаётся.
 */
function upsertShortcutStrings(stringsPath, labels, { isDefault = false } = {}) {
  const block = renderShortcutStrings(labels);
  let content = fs.existsSync(stringsPath)
    ? fs.readFileSync(stringsPath, 'utf8').replace(SHORTCUT_STRING_LINE, '')
    : '<resources>\n</resources>\n';
  if (!content.includes('</resources>')) {
    throw new Error(`withAndroidShortcuts: ${stringsPath} has no </resources> root`);
  }
  if (isDefault) content = allowMissingTranslations(content);
  content = content.replace('</resources>', `${block}\n</resources>`);
  fs.mkdirSync(path.dirname(stringsPath), { recursive: true });
  fs.writeFileSync(stringsPath, content, 'utf8');
  return content;
}

/** Каталог ресурсов локали: default-локаль — `values/`, остальные — `values-<locale>/`. */
function valuesDirFor(locale) {
  return locale === DEFAULT_LOCALE ? 'values' : `values-${locale}`;
}

function writeShortcutResources(resDir) {
  const xmlDir = path.join(resDir, 'xml');
  fs.mkdirSync(xmlDir, { recursive: true });
  fs.writeFileSync(path.join(xmlDir, 'shortcuts.xml'), SHORTCUTS_XML, 'utf8');

  for (const [locale, labels] of Object.entries(SHORTCUT_LABELS)) {
    upsertShortcutStrings(path.join(resDir, valuesDirFor(locale), 'strings.xml'), labels, {
      isDefault: locale === DEFAULT_LOCALE,
    });
  }
}

function withAndroidShortcuts(config) {
  const { withAndroidManifest, withDangerousMod } = require('expo/config-plugins');

  // Step 1: Add shortcuts.xml and localized string resources
  config = withDangerousMod(config, [
    'android',
    async (config) => {
      writeShortcutResources(
        path.join(config.modRequest.platformProjectRoot, 'app', 'src', 'main', 'res'),
      );
      return config;
    },
  ]);

  // Step 2: Add <meta-data> to AndroidManifest.xml
  config = withAndroidManifest(config, async (config) => {
    const manifest = config.modResults;
    const mainActivity = manifest.manifest.application?.[0]?.activity?.find(
      (a) => a.$?.['android:name'] === '.MainActivity',
    );

    if (mainActivity) {
      // Ensure meta-data array exists
      if (!mainActivity['meta-data']) {
        mainActivity['meta-data'] = [];
      }

      // Check if already added
      const alreadyExists = mainActivity['meta-data'].some(
        (m) => m.$?.['android:name'] === 'android.app.shortcuts',
      );

      if (!alreadyExists) {
        mainActivity['meta-data'].push({
          $: {
            'android:name': 'android.app.shortcuts',
            'android:resource': '@xml/shortcuts',
          },
        });
      }
    }

    return config;
  });

  return config;
}

module.exports = withAndroidShortcuts;
module.exports.DEFAULT_LOCALE = DEFAULT_LOCALE;
module.exports.SHORTCUT_LABELS = SHORTCUT_LABELS;
module.exports.SHORTCUTS_XML = SHORTCUTS_XML;
module.exports.escapeAndroidString = escapeAndroidString;
module.exports.renderShortcutStrings = renderShortcutStrings;
module.exports.upsertShortcutStrings = upsertShortcutStrings;
module.exports.allowMissingTranslations = allowMissingTranslations;
module.exports.writeShortcutResources = writeShortcutResources;


