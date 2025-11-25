// components/listTravel/hooks/useListTravelExportEnhanced.ts
// ✅ УЛУЧШЕНИЕ: Улучшенный хук для экспорта в PDF-фотоальбом

import { useCallback, useRef, useState } from 'react';
import { Platform, Alert } from 'react-native';
import { BookSettings } from '@/components/export/BookSettingsModal';
import type { Travel } from '@/src/types/types';
import { BookHtmlExportService } from '@/src/services/book/BookHtmlExportService';
import { openBookPreviewWindow } from '@/src/utils/openBookPreviewWindow';

interface UseListTravelExportEnhancedProps {
  selected: Travel[] | any[];
  userName?: string;
}

export function useListTravelExportEnhanced({ selected, userName }: UseListTravelExportEnhancedProps) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [showSettings, setShowSettings] = useState(false);
  const [settings, setSettings] = useState<BookSettings | null>(null);
  const htmlServiceRef = useRef<BookHtmlExportService | null>(null);

  const defaultSettings: BookSettings = {
    title: userName ? `Путешествия ${userName}` : 'Мои путешествия',
    subtitle: '',
    coverType: 'auto',
    template: 'minimal',
    format: 'A4',
    orientation: 'portrait',
    margins: 'standard',
    imageQuality: 'high',
    sortOrder: 'date-desc',
    includeToc: true,
    includeGallery: true,
    includeMap: true,
    colorTheme: 'blue',
    fontFamily: 'sans',
    photoMode: 'gallery',
    mapMode: 'full-page',
    includeChecklists: false,
    checklistSections: ['clothing', 'food', 'electronics'],
  };

  const openPrintBook = useCallback(
    async (bookSettings: BookSettings) => {
      if (!selected.length) {
        Alert.alert('Внимание', 'Пожалуйста, выберите хотя бы одно путешествие');
        return;
      }

      if (Platform.OS !== 'web') {
        Alert.alert('Недоступно', 'Просмотр книги и печать доступны только в веб-версии');
        return;
      }

      if (!htmlServiceRef.current) {
        htmlServiceRef.current = new BookHtmlExportService();
      }

      setIsGenerating(true);
      setProgress(0);

      try {
        const travels = selected as Travel[];
        const html = await htmlServiceRef.current.generateTravelsHtml(travels, bookSettings);
        openBookPreviewWindow(html);
        setProgress(100);
      } catch (error: any) {
        Alert.alert(
          'Ошибка',
          error instanceof Error
            ? error.message
            : 'Произошла ошибка при открытии книги для печати',
        );
      } finally {
        setIsGenerating(false);
        setProgress(0);
      }
    },
    [selected],
  );

  const handleSave = useCallback((bookSettings: BookSettings) => {
    setSettings(bookSettings);
    // Сохранение книги переводим на новый HTML-поток печати:
    // открываем книгу в новой вкладке, дальше пользователь выбирает "Сохранить как PDF" в диалоге печати.
    openPrintBook(bookSettings);
  }, [openPrintBook]);

  const handlePreview = useCallback((bookSettings: BookSettings) => {
    // Для превью списка путешествий используем HTML-книгу с печатью,
    // а существующее PDF-превью оставляем как legacy при необходимости.
    openPrintBook(bookSettings);
  }, [openPrintBook]);

  return {
    isGenerating,
    progress,
    showSettings,
    setShowSettings,
    settings: settings || defaultSettings,
    handleSave,
    handlePreview,
    defaultSettings,
  };
}
