// #2142: the native launch splash, its committed iOS assets and the JS launch
// cover (constants/launchSplash.ts) are one picture. app.json's
// expo-splash-screen entry is the source of truth; the iOS project is
// committed, so its assets must be regenerated from it (the shipped iOS splash
// was the Expo template placeholder — a grey grid icon — while app.json named
// the MeTravel logo).
import fs from 'fs';
import path from 'path';

import {
  LAUNCH_SPLASH_BACKGROUND,
  LAUNCH_SPLASH_IMAGE_WIDTH,
} from '@/constants/launchSplash';

const ROOT = path.resolve(__dirname, '../..');
const IOS = path.join(ROOT, 'ios/metravel');
const IMAGESET = path.join(IOS, 'Images.xcassets/SplashScreenLogo.imageset');

const appJson = JSON.parse(fs.readFileSync(path.join(ROOT, 'app.json'), 'utf8'));
const splashEntry = (appJson.expo.plugins as unknown[]).find(
  (p): p is [string, Record<string, any>] => Array.isArray(p) && p[0] === 'expo-splash-screen',
);
if (!splashEntry) throw new Error('expo-splash-screen plugin entry is missing in app.json');
const splash = splashEntry[1];

function pngWidth(file: string): number {
  // IHDR: 8-byte signature, 4-byte length, 4-byte type, then width (BE uint32).
  return fs.readFileSync(file).readUInt32BE(16);
}

function hexOfColorset(color: { components: Record<string, string> }): string {
  const c = color.components;
  const channel = (v: string) => Math.round(Number(v) * 255).toString(16).padStart(2, '0');
  return `#${channel(c.red)}${channel(c.green)}${channel(c.blue)}`;
}

describe('launch splash contract (#2142)', () => {
  it('the JS cover mirrors the app.json splash config', () => {
    expect(splash.image).toBe('./assets/images/splash.png');
    expect(splash.imageWidth ?? 100).toBe(LAUNCH_SPLASH_IMAGE_WIDTH);
    expect(splash.backgroundColor.toLowerCase()).toBe(LAUNCH_SPLASH_BACKGROUND.light);
    expect(splash.dark.backgroundColor.toLowerCase()).toBe(LAUNCH_SPLASH_BACKGROUND.dark);
  });

  it('the committed iOS splash logo is the app.json image at imageWidth, not the template placeholder', () => {
    expect(pngWidth(path.join(IMAGESET, 'image.png'))).toBe(LAUNCH_SPLASH_IMAGE_WIDTH);
    expect(pngWidth(path.join(IMAGESET, 'image@2x.png'))).toBe(LAUNCH_SPLASH_IMAGE_WIDTH * 2);
    expect(pngWidth(path.join(IMAGESET, 'image@3x.png'))).toBe(LAUNCH_SPLASH_IMAGE_WIDTH * 3);
  });

  it('the iOS storyboard centers the logo at imageWidth', () => {
    const storyboard = fs.readFileSync(path.join(IOS, 'SplashScreen.storyboard'), 'utf8');
    const w = LAUNCH_SPLASH_IMAGE_WIDTH;
    expect(storyboard).toContain(`<image name="SplashScreenLogo" width="${w}" height="${w}"/>`);
    expect(storyboard).toMatch(/firstItem="EXPO-SplashScreen" firstAttribute="centerX"/);
    expect(storyboard).toMatch(/firstItem="EXPO-SplashScreen" firstAttribute="centerY"/);
  });

  it('the iOS splash background matches app.json in both appearances', () => {
    const colorset = JSON.parse(
      fs.readFileSync(path.join(IOS, 'Images.xcassets/SplashScreenBackground.colorset/Contents.json'), 'utf8'),
    );
    const isDark = (entry: any) =>
      (entry.appearances ?? []).some((a: any) => a.appearance === 'luminosity' && a.value === 'dark');
    const light = colorset.colors.find((entry: any) => !isDark(entry));
    const dark = colorset.colors.find(isDark);
    expect(hexOfColorset(light.color)).toBe(LAUNCH_SPLASH_BACKGROUND.light);
    expect(hexOfColorset(dark.color)).toBe(LAUNCH_SPLASH_BACKGROUND.dark);
  });
});
