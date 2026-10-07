import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

import {
  GUEST_QUEST_PREVIEW_KEY,
  recordGuestQuestPreview,
} from '@/utils/guestTrialState';

describe('guestTrialState', () => {
  const originalPlatform = Platform.OS;

  beforeEach(() => {
    jest.clearAllMocks();
    (AsyncStorage as any).__reset?.();
    jest.spyOn(Date, 'now').mockReturnValue(1780000000000);
  });

  afterEach(() => {
    (Platform as any).OS = originalPlatform;
    jest.restoreAllMocks();
  });

  it('records Android guest quest preview as best-effort local state', async () => {
    (Platform as any).OS = 'android';

    await recordGuestQuestPreview({
      questId: 'minsk-cmok',
      cityId: '4',
      stepId: 'step-1',
    });

    const raw = await AsyncStorage.getItem(GUEST_QUEST_PREVIEW_KEY);
    expect(raw).toBeTruthy();
    expect(JSON.parse(raw || '[]')).toEqual([
      {
        questId: 'minsk-cmok',
        cityId: '4',
        stepId: 'step-1',
        savedAt: 1780000000000,
      },
    ]);
  });

  it('does not record guest quest preview outside Android', async () => {
    (Platform as any).OS = 'web';

    await recordGuestQuestPreview({ questId: 'minsk-cmok', cityId: '4' });

    expect(AsyncStorage.setItem).not.toHaveBeenCalled();
  });
});
