// plugins/withAndroidShortcuts.js
// AND-20: Expo config plugin to add Android App Shortcuts.
// Long-press on app icon → "Поиск", "Карта", "Избранное".
//
/* eslint-env node */
/* eslint-disable no-undef */
//
// This plugin:
// 1. Creates res/xml/shortcuts.xml with 3 static shortcuts
// 2. Adds <meta-data> to AndroidManifest.xml referencing the shortcuts

const { withAndroidManifest, withDangerousMod } = require('expo/config-plugins');
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
            android:data="myapp:///search" />
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
            android:data="myapp:///map" />
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
            android:data="myapp:///favorites" />
        <categories android:name="android.shortcut.conversation" />
    </shortcut>
</shortcuts>`;

const SHORTCUT_STRINGS = `
    <string name="shortcut_search_short">Поиск</string>
    <string name="shortcut_search_long">Поиск маршрутов</string>
    <string name="shortcut_map_short">Карта</string>
    <string name="shortcut_map_long">Карта маршрутов</string>
    <string name="shortcut_favorites_short">Избранное</string>
    <string name="shortcut_favorites_long">Избранные маршруты</string>`;

function withAndroidShortcuts(config) {
  // Step 1: Add shortcuts.xml and string resources
  config = withDangerousMod(config, [
    'android',
    async (config) => {
      const resDir = path.join(
        config.modRequest.platformProjectRoot,
        'app',
        'src',
        'main',
        'res',
      );

      // Create res/xml/shortcuts.xml
      const xmlDir = path.join(resDir, 'xml');
      if (!fs.existsSync(xmlDir)) {
        fs.mkdirSync(xmlDir, { recursive: true });
      }
      fs.writeFileSync(path.join(xmlDir, 'shortcuts.xml'), SHORTCUTS_XML, 'utf8');

      // Add shortcut strings to res/values/strings.xml
      const stringsPath = path.join(resDir, 'values', 'strings.xml');
      if (fs.existsSync(stringsPath)) {
        let content = fs.readFileSync(stringsPath, 'utf8');
        if (!content.includes('shortcut_search_short')) {
          content = content.replace('</resources>', SHORTCUT_STRINGS + '\n</resources>');
          fs.writeFileSync(stringsPath, content, 'utf8');
        }
      }

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


