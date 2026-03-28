describe('imageAnalysis CORS guard', () => {
  beforeEach(() => {
    jest.resetModules();
  });

  it('skips pixel analysis for cross-origin images outside same origin and weserv', async () => {
    jest.unmock('@/utils/imageAnalysis');

    const imageCtor = jest.fn();
    Object.defineProperty(global, 'Image', {
      value: imageCtor,
      configurable: true,
      writable: true,
    });

    const mod = await import('@/utils/imageAnalysis');

    await expect(
      mod.analyzeImageBrightness('https://metravel.by/travel-image/560/conversions/file.webp')
    ).resolves.toBe(128);
    await expect(
      mod.analyzeImageComposition('https://metravel.by/travel-image/560/conversions/file.webp')
    ).resolves.toEqual({ topBusy: 0.5, centerBusy: 0.5, bottomBusy: 0.5 });

    expect(imageCtor).not.toHaveBeenCalled();
  });
});
