// src/services/pdf-export/generators/v2/config/defaults.ts
// ✅ CONFIG: Конфигурация по умолчанию для v2

import type { ImageProcessorConfig } from '../types';

/**
 * Конфигурация по умолчанию для v2
 */
export const defaultConfig = {
  imageProcessor: {
    // #1163: адреса стороннего ресайзера в конфиге больше нет. `proxyEnabled`
    // по-прежнему решает, проксировать ли вообще, а `maxWidth` теперь обязан быть
    // ступенью лестницы прокси — 1600 — иначе запрос округлится вверх.
    proxyEnabled: true,
    maxWidth: 1600,
    cacheEnabled: true,
    cacheTTL: 3600000, // 1 час
  } as ImageProcessorConfig,
};

