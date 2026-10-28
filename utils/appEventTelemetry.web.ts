// События удержания — только нативное приложение (#2841). На web остаются
// gtag и Метрика; очередь и окружение в web-бандл не входят.

export async function recordNativeAnalyticsEvent(
  _eventName?: string,
  _eventParams?: Record<string, unknown>,
): Promise<void> {}

export function installAppEventTelemetry(): void {}
