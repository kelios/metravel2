import type { TravelForBook } from '@/src/types/pdf-export';
import type { BookSettings } from '@/components/export/BookSettingsModal';
import { EnhancedPdfGenerator } from '@/src/services/pdf-export/generators/EnhancedPdfGenerator';

/**
 * Обёртка для генерации полноценного HTML-фотоальбома.
 * Используется только в тестах и внутренних утилитах проверки контента.
 */
export async function buildPhotoBookHTML(
  travels: TravelForBook[],
  settings: BookSettings
): Promise<string> {
  const generator = new EnhancedPdfGenerator(settings.template);
  return generator.generate(travels, settings);
}
