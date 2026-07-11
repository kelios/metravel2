import { Platform, Share } from 'react-native';

import { shareTripPlan } from '@/utils/shareTripPlan';

describe('shareTripPlan', () => {
  const originalPlatform = Platform.OS;
  const originalNavigatorDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'navigator');

  beforeEach(() => {
    jest.clearAllMocks();
    Object.defineProperty(Platform, 'OS', { configurable: true, value: 'android' });
  });

  afterEach(() => {
    jest.restoreAllMocks();
    Object.defineProperty(Platform, 'OS', { configurable: true, value: originalPlatform });
    if (originalNavigatorDescriptor) {
      Object.defineProperty(globalThis, 'navigator', originalNavigatorDescriptor);
    } else {
      delete (globalThis as { navigator?: Navigator }).navigator;
    }
  });

  it('shares readable text with the canonical public planned-trip URL', async () => {
    jest.spyOn(Share, 'share').mockResolvedValue({ action: Share.sharedAction } as never);

    await expect(shareTripPlan({ id: 8001, title: 'Браславские озёра' })).resolves.toBe(
      'shared',
    );

    expect(Share.share).toHaveBeenCalledWith(
      {
        title: 'Браславские озёра',
        message:
          'Присоединяйтесь к поездке «Браславские озёра» в MeTravel\n' +
          'https://metravel.by/trips/plan/8001',
      },
      { dialogTitle: 'Поделиться поездкой «Браславские озёра»' },
    );
  });

  it('treats cancellation as quiet and allows a later repeated share', async () => {
    jest.spyOn(Share, 'share').mockResolvedValue({ action: Share.dismissedAction } as never);

    const trip = { id: 8001, title: 'Браславские озёра' };
    await expect(shareTripPlan(trip)).resolves.toBe('dismissed');
    await expect(shareTripPlan(trip)).resolves.toBe('dismissed');

    expect(Share.share).toHaveBeenCalledTimes(2);
  });

  it('uses the Web Share API with the same canonical URL', async () => {
    Object.defineProperty(Platform, 'OS', { configurable: true, value: 'web' });
    const nativeShare = jest.spyOn(Share, 'share');
    const webShare = jest.fn().mockResolvedValue(undefined);
    Object.defineProperty(globalThis, 'navigator', {
      configurable: true,
      value: { share: webShare },
    });

    await expect(shareTripPlan({ id: 8001, title: 'Браславские озёра' })).resolves.toBe(
      'shared',
    );

    expect(webShare).toHaveBeenCalledWith({
      title: 'Браславские озёра',
      text: 'Присоединяйтесь к поездке «Браславские озёра» в MeTravel',
      url: 'https://metravel.by/trips/plan/8001',
    });
    expect(nativeShare).not.toHaveBeenCalled();
  });

  it('copies the canonical URL on web when Web Share is unavailable', async () => {
    Object.defineProperty(Platform, 'OS', { configurable: true, value: 'web' });
    const nativeShare = jest.spyOn(Share, 'share');
    const writeText = jest.fn().mockResolvedValue(undefined);
    Object.defineProperty(globalThis, 'navigator', {
      configurable: true,
      value: { clipboard: { writeText } },
    });

    await expect(shareTripPlan({ id: 8001, title: 'Браславские озёра' })).resolves.toBe(
      'shared',
    );

    expect(writeText).toHaveBeenCalledWith('https://metravel.by/trips/plan/8001');
    expect(nativeShare).not.toHaveBeenCalled();
  });

  it('treats a cancelled Web Share request as dismissed without clipboard side effects', async () => {
    Object.defineProperty(Platform, 'OS', { configurable: true, value: 'web' });
    const writeText = jest.fn();
    const webShare = jest.fn().mockRejectedValue({ name: 'AbortError' });
    Object.defineProperty(globalThis, 'navigator', {
      configurable: true,
      value: { share: webShare, clipboard: { writeText } },
    });

    await expect(shareTripPlan({ id: 8001, title: 'Браславские озёра' })).resolves.toBe(
      'dismissed',
    );
    expect(writeText).not.toHaveBeenCalled();
  });

  it('does not open the share sheet without a public numeric trip id', async () => {
    const shareSpy = jest.spyOn(Share, 'share');

    await expect(shareTripPlan({ id: 'local-draft', title: 'Черновик' })).resolves.toBe(
      'unavailable',
    );
    expect(shareSpy).not.toHaveBeenCalled();
  });
});
