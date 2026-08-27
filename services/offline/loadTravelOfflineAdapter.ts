type TravelOfflineAdapterModule = typeof import('./travelOfflineAdapter');

/**
 * Единая async-точка для тяжёлого travel-offline адаптера.
 *
 * Его санитайзер, HTML-парсер и хранилище не нужны первому экрану статьи:
 * адаптер исполняется только при офлайн-чтении, фоновом кэшировании или после
 * явного нажатия «Сохранить офлайн». Один чокпоинт сохраняет стабильную
 * группировку Metro, даже когда эти ветки вызываются из разных компонентов.
 */
export const loadTravelOfflineAdapter = (): Promise<TravelOfflineAdapterModule> =>
  import('./travelOfflineAdapter');
