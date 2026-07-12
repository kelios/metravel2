jest.mock('expo-file-system/legacy', () => ({
  cacheDirectory: 'file:///cache/',
  writeAsStringAsync: jest.fn(),
}));
jest.mock('expo-sharing', () => ({
  isAvailableAsync: jest.fn(),
  shareAsync: jest.fn(),
}));

const FileSystem = require('expo-file-system/legacy');
const Sharing = require('expo-sharing');

import {
  isQuestMapPngMessage,
  QUEST_MAP_PNG_MESSAGE_TYPE,
  QUEST_MAP_PNG_RENDERER_SCRIPT,
  saveAndShareQuestMapPng,
} from '@/components/quests/questNativeMapPng';

const PNG_DATA_URL = 'data:image/png;base64,QUJD';

describe('saveAndShareQuestMapPng', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    Sharing.isAvailableAsync.mockResolvedValue(true);
  });

  it('writes the decoded PNG to cache and opens the native share sheet', async () => {
    await expect(
      saveAndShareQuestMapPng({ dataUrl: PNG_DATA_URL, title: 'Квест Краков' })
    ).resolves.toBe(true);

    expect(FileSystem.writeAsStringAsync).toHaveBeenCalledWith(
      'file:///cache/Квест_Краков.png',
      'QUJD',
      { encoding: 'base64' }
    );
    expect(Sharing.shareAsync).toHaveBeenCalledWith(
      'file:///cache/Квест_Краков.png',
      expect.objectContaining({ mimeType: 'image/png' })
    );
  });

  it('rejects a non-PNG data URL without writing or sharing', async () => {
    await expect(
      saveAndShareQuestMapPng({ dataUrl: 'data:image/jpeg;base64,QUJD', title: 'x' })
    ).resolves.toBe(false);
    expect(FileSystem.writeAsStringAsync).not.toHaveBeenCalled();
    expect(Sharing.shareAsync).not.toHaveBeenCalled();
  });

  it('returns false for a null snapshot (graceful fallback, no broken PNG)', async () => {
    await expect(saveAndShareQuestMapPng({ dataUrl: null, title: 'x' })).resolves.toBe(false);
    expect(FileSystem.writeAsStringAsync).not.toHaveBeenCalled();
  });

  it('returns false when native sharing is unavailable', async () => {
    Sharing.isAvailableAsync.mockResolvedValue(false);
    await expect(saveAndShareQuestMapPng({ dataUrl: PNG_DATA_URL, title: 'x' })).resolves.toBe(
      false
    );
    expect(FileSystem.writeAsStringAsync).toHaveBeenCalled();
    expect(Sharing.shareAsync).not.toHaveBeenCalled();
  });
});

describe('isQuestMapPngMessage', () => {
  it('recognises the WebView PNG payload and rejects other messages', () => {
    expect(
      isQuestMapPngMessage({ type: QUEST_MAP_PNG_MESSAGE_TYPE, ok: true, dataUrl: PNG_DATA_URL })
    ).toBe(true);
    expect(isQuestMapPngMessage({ type: 'quest-map-status' })).toBe(false);
    expect(isQuestMapPngMessage(null)).toBe(false);
  });
});

describe('QUEST_MAP_PNG_RENDERER_SCRIPT', () => {
  it('defines the injectable renderer that posts a PNG data URL back to native', () => {
    expect(QUEST_MAP_PNG_RENDERER_SCRIPT).toContain('window.__qmExportPng');
    expect(QUEST_MAP_PNG_RENDERER_SCRIPT).toContain("canvas.toDataURL('image/png')");
    expect(QUEST_MAP_PNG_RENDERER_SCRIPT).toContain(QUEST_MAP_PNG_MESSAGE_TYPE);
    expect(QUEST_MAP_PNG_RENDERER_SCRIPT).toContain("crossOrigin = 'anonymous'");
  });
});
