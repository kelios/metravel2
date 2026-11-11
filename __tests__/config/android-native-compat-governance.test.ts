/** @jest-environment node */

import * as fs from 'fs';
import * as path from 'path';
import { itWithGeneratedAndroid } from '../helpers/generatedNativeProject';

const ROOT = path.resolve(__dirname, '..', '..');

describe('Android generated native project governance', () => {
  itWithGeneratedAndroid('AND-USB-14: Android manifest exposes documented metravel:// scheme and https app links', () => {
    const appConfig = JSON.parse(fs.readFileSync(path.join(ROOT, 'app.json'), 'utf8'));
    const manifestPath = path.join(ROOT, 'android', 'app', 'src', 'main', 'AndroidManifest.xml');
    const manifest = fs.readFileSync(manifestPath, 'utf8');

    expect(appConfig.expo?.scheme).toBe('metravel');
    expect(appConfig.expo?.android?.package).toBe('by.metravel.app');
    expect(manifest).toContain('android:scheme="metravel"');
    expect(manifest).toContain('android:scheme="https" android:host="metravel.by"');
    expect(manifest).not.toContain('android:scheme="myapp"');
  });

  itWithGeneratedAndroid('Android 15/16 store readiness: no legacy system-bar color or orientation restrictions', () => {
    const appConfig = JSON.parse(fs.readFileSync(path.join(ROOT, 'app.json'), 'utf8'));
    const manifest = fs.readFileSync(
      path.join(ROOT, 'android', 'app', 'src', 'main', 'AndroidManifest.xml'),
      'utf8',
    );
    const appGradle = fs.readFileSync(path.join(ROOT, 'android', 'app', 'build.gradle'), 'utf8');
    const settingsGradle = fs.readFileSync(path.join(ROOT, 'android', 'settings.gradle'), 'utf8');
    const releaseSafetyPlugin = fs.readFileSync(
      path.join(ROOT, 'plugins', 'withAndroidReleaseSafety.js'),
      'utf8',
    );
    const androidProperties = fs.readFileSync(
      path.join(ROOT, 'android', 'gradle.properties'),
      'utf8',
    );
    const androidStyles = fs.readFileSync(
      path.join(ROOT, 'android', 'app', 'src', 'main', 'res', 'values', 'styles.xml'),
      'utf8',
    );
    const reactNativePatches = fs
      .readdirSync(path.join(ROOT, 'patches'))
      .filter((name) => name.startsWith('react-native+'));
    const layout = fs.readFileSync(path.join(ROOT, 'app', '_layout.tsx'), 'utf8');
    const nativeRuntime = fs.readFileSync(
      path.join(ROOT, 'components', 'layout', 'NativeAppRuntime.native.tsx'),
      'utf8',
    );

    expect(appConfig.expo?.orientation).toBe('default');
    expect(manifest).not.toContain('android:screenOrientation=');
    expect(manifest).toContain('android:resizeableActivity="true"');
    expect(androidProperties).toMatch(/^edgeToEdgeEnabled=true$/m);
    expect(appGradle).toContain('com.google.android.material:material:1.14.0');
    expect(appGradle).toContain('getDefaultProguardFile("proguard-android-optimize.txt")');
    expect(releaseSafetyPlugin).toContain('com.google.android.material:material:1.14.0');
    expect(releaseSafetyPlugin).toContain("'android.enableMinifyInReleaseBuilds': 'true'");
    expect(releaseSafetyPlugin).toContain(
      "'android.enableShrinkResourcesInReleaseBuilds': 'true'",
    );
    expect(releaseSafetyPlugin).toContain("'android.r8.optimizedResourceShrinking': 'true'");
    expect(androidProperties).toMatch(
      /^org\.gradle\.jvmargs=-Xmx2048m -XX:MaxMetaspaceSize=1024m$/m,
    );
    expect(androidProperties).toMatch(/^android\.enableMinifyInReleaseBuilds=true$/m);
    expect(androidProperties).toMatch(/^android\.enableShrinkResourcesInReleaseBuilds=true$/m);
    expect(androidProperties).toMatch(/^android\.r8\.optimizedResourceShrinking=true$/m);
    // #2743: React Native и Hermes берутся prebuilt-артефактами. Патч WindowUtil
    // (Android 15+ без deprecated color-сеттеров) снят: вызовы этих API остаются
    // в androidx/material/expo-navigation-bar, а на API 35+ сеттеры — no-op.
    // Сборка RN из исходников ради патча стоила десятки минут на каждую сборку.
    expect(reactNativePatches).toEqual([]);
    expect(settingsGradle).not.toContain("includeBuild('../node_modules/react-native')");
    expect(settingsGradle).not.toContain('com.facebook.react:react-android');
    expect(releaseSafetyPlugin).not.toContain('includeBuild');
    expect(releaseSafetyPlugin).toContain("name: 'android:statusBarColor'");
    expect(releaseSafetyPlugin).toContain("name: 'android:navigationBarColor'");
    expect(androidStyles).not.toContain('android:statusBarColor');
    expect(androidStyles).not.toContain('android:navigationBarColor');
    expect(layout).not.toMatch(/<RNStatusBar[\s\S]{0,220}\b(backgroundColor|translucent)=/);
    expect(nativeRuntime).not.toContain('setBackgroundColorAsync');
  });
});
