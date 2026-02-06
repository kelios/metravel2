// src/services/pdf-export/generators/v2/config/defaults.ts
// ✅ CONFIG: Конфигурация по умолчанию для v2

import type { ImageProcessorConfig } from '../types';

/**
 * Конфигурация по умолчанию для v2
 */
export const defaultConfig = {
  imageProcessor: {
    proxyEnabled: true,
    proxyUrl: 'https://images.weserv.nl/?url=',
    maxWidth: 1200,
    cacheEnabled: true,
    cacheTTL: 3600000, // 1 час
  } as ImageProcessorConfig,
};

