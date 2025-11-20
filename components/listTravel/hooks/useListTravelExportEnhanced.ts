// components/listTravel/hooks/useListTravelExportEnhanced.ts
// ✅ УЛУЧШЕНИЕ: Улучшенный хук для экспорта в PDF-фотоальбом

import { useCallback, useRef, useState } from 'react';
import { Platform, Alert } from 'react-native';
import { buildPhotoBookHTML, TravelForBook } from '@/src/utils/pdfBookGenerator';
import { BookSettings } from '@/components/export/BookSettingsModal';
import { saveHtmlAsPdf, getPdfBlob } from '@/src/utils/html2pdf';
import type { Travel } from '@/src/types/types';
import { pdfLog, pdfWarn, pdfError } from '@/src/utils/logger';

interface UseListTravelExportEnhancedProps {
  selected: Travel[] | any[];
  userName?: string;
}

// Преобразование Travel в TravelForBook
function convertTravelToBookFormat(travel: any): TravelForBook {
  // ✅ КРИТИЧНО: Заменяем все undefined на пустые строки или null, чтобы избежать ошибок в html2pdf
  // ✅ ОТЛАДКА: Логируем входные данные
  if (!travel) {
    pdfError('[convertTravelToBookFormat] Travel is null or undefined');
    throw new Error('Travel is null or undefined');
  }
  
  // ✅ КРИТИЧНО: Логируем входные данные для диагностики (только в dev)
  pdfLog(`[convertTravelToBookFormat] INPUT Travel ${travel.id} (${travel.name}):`, {
    hasDescription: travel.description != null,
    descriptionType: typeof travel.description,
    descriptionValue: travel.description ? (typeof travel.description === 'string' ? travel.description.substring(0, 50) + '...' : String(travel.description).substring(0, 50)) : 'null/undefined',
    hasGallery: travel.gallery != null,
    galleryType: typeof travel.gallery,
    galleryIsArray: Array.isArray(travel.gallery),
    galleryLength: Array.isArray(travel.gallery) ? travel.gallery.length : 'N/A',
    galleryFirstItem: Array.isArray(travel.gallery) && travel.gallery.length > 0 ? travel.gallery[0] : 'N/A',
  });
  
  // ✅ ИСПРАВЛЕНИЕ: Обрабатываем gallery отдельно для лучшей отладки
  let gallery: TravelForBook['gallery'] = undefined;
  if (travel.gallery) {
    if (Array.isArray(travel.gallery) && travel.gallery.length > 0) {
      const filtered = travel.gallery
        .filter((g: any) => {
          if (!g) return false;
          const url = typeof g === 'string' ? g : (g.url || g);
          return url && typeof url === 'string' && url.trim().length > 0;
        })
        .map((g: any) => ({
          url: typeof g === 'string' ? g : (g.url || g),
          id: typeof g === 'string' ? undefined : (g.id || g.url),
          updated_at: typeof g === 'string' ? undefined : g.updated_at,
        }));
      
      // Если после фильтрации массив не пустой, используем его
      if (filtered.length > 0) {
        gallery = filtered;
      }
    }
  }
  
  // ✅ ИСПРАВЛЕНИЕ: Обрабатываем travelAddress отдельно
  let travelAddress: TravelForBook['travelAddress'] = undefined;
  if (travel.travelAddress) {
    if (Array.isArray(travel.travelAddress) && travel.travelAddress.length > 0) {
      travelAddress = travel.travelAddress.map((addr: any) => ({
        id: String(addr.id || addr),
        address: typeof addr === 'string' ? addr : (addr.address || addr.name || ''),
        coord: typeof addr === 'string' ? '' : (addr.coord || ''),
        travelImageThumbUrl: typeof addr === 'string' ? undefined : addr.travelImageThumbUrl,
        categoryName: typeof addr === 'string' ? undefined : addr.categoryName,
      }));
    }
  }
  
  const result: TravelForBook = {
    id: travel.id,
    name: travel.name || '',
    slug: travel.slug || undefined,
    url: travel.url || undefined,
    // ✅ ИСПРАВЛЕНИЕ: Заменяем undefined на null для строковых полей, но сохраняем пустые строки
    description: travel.description != null ? (typeof travel.description === 'string' ? travel.description : String(travel.description)) : null,
    recommendation: travel.recommendation != null ? (typeof travel.recommendation === 'string' ? travel.recommendation : String(travel.recommendation)) : null,
    plus: travel.plus != null ? (typeof travel.plus === 'string' ? travel.plus : String(travel.plus)) : null,
    minus: travel.minus != null ? (typeof travel.minus === 'string' ? travel.minus : String(travel.minus)) : null,
    countryName: travel.countryName || null,
    cityName: travel.cityName || null,
    year: travel.year || null,
    monthName: travel.monthName || null,
    number_days: travel.number_days || null,
    travel_image_thumb_url: travel.travel_image_thumb_url || null,
    travel_image_url: travel.travel_image_url || null,
    gallery,
    travelAddress,
    youtube_link: travel.youtube_link || null,
    userName: travel.userName || null,
  };
  
  // ✅ ОТЛАДКА: Логируем результат преобразования (только в dev)
  pdfLog(`[convertTravelToBookFormat] OUTPUT Travel ${travel.id} (${travel.name}):`, {
    description: result.description ? `[${result.description.length} chars]` : 'null',
    descriptionType: typeof result.description,
    recommendation: result.recommendation ? `[${result.recommendation.length} chars]` : 'null',
    recommendationType: typeof result.recommendation,
    plus: result.plus ? `[${result.plus.length} chars]` : 'null',
    minus: result.minus ? `[${result.minus.length} chars]` : 'null',
    gallery: result.gallery ? `[${result.gallery.length} items]` : 'null/undefined',
    galleryType: typeof result.gallery,
    galleryIsArray: Array.isArray(result.gallery),
    galleryRaw: travel.gallery ? (Array.isArray(travel.gallery) ? `[${travel.gallery.length} items]` : typeof travel.gallery) : 'null/undefined',
  });
  
  return result;
}

export function useListTravelExportEnhanced({ selected, userName }: UseListTravelExportEnhancedProps) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [showSettings, setShowSettings] = useState(false);
  const [settings, setSettings] = useState<BookSettings | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const defaultSettings: BookSettings = {
    title: userName ? `Путешествия ${userName}` : 'Мои путешествия',
    subtitle: '',
    coverType: 'auto',
    template: 'classic',
    format: 'A4',
    orientation: 'portrait',
    margins: 'standard',
    imageQuality: 'high',
    sortOrder: 'date-desc',
    includeToc: true,
    includeGallery: true,
    includeMap: true,
  };

  const generatePDF = useCallback(async (bookSettings: BookSettings) => {
    if (!selected.length) {
      Alert.alert('Внимание', 'Пожалуйста, выберите хотя бы одно путешествие');
      return;
    }

    if (Platform.OS !== 'web') {
      Alert.alert('Недоступно', 'Экспорт PDF доступен только в веб-версии');
      return;
    }

    setIsGenerating(true);
    setProgress(0);

    try {
      // Преобразуем данные в формат для книги
      const travelsForBook: TravelForBook[] = selected.map(convertTravelToBookFormat);

      // ✅ ИСПРАВЛЕНИЕ: Создаем контейнер для HTML (видимый для html2canvas, но скрыт от пользователя)
      const container = document.createElement('div');
      container.style.position = 'fixed';
      container.style.left = '-9999px';
      container.style.top = '0';
      container.style.width = '210mm';
      container.style.minHeight = '297mm';
      container.style.backgroundColor = '#fff';
      container.style.overflow = 'visible';
      document.body.appendChild(container);
      containerRef.current = container;

      setProgress(10);

      // Генерируем HTML
      const html = await buildPhotoBookHTML(travelsForBook, bookSettings);
      setProgress(40);

      // ✅ ИСПРАВЛЕНИЕ: Извлекаем только содержимое body из полного HTML
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, 'text/html');
      const bodyContent = doc.body.innerHTML;
      const headStyles = doc.head.querySelectorAll('style');
      
      pdfLog('[PDFExport] Body content length:', bodyContent.length);
      pdfLog('[PDFExport] Styles found:', headStyles.length);
      
      // Вставляем стили в контейнер
      if (headStyles.length > 0) {
        const styleElement = document.createElement('style');
        styleElement.textContent = Array.from(headStyles).map(s => s.textContent).join('\n');
        container.appendChild(styleElement);
      }
      
      // Вставляем содержимое body
      container.innerHTML = bodyContent;
      
      pdfLog('[PDFExport] Container innerHTML length:', container.innerHTML.length);
      pdfLog('[PDFExport] Container children:', container.children.length);
      
      // ✅ ИСПРАВЛЕНИЕ: Проверяем, что контент действительно вставлен
      if (container.children.length === 0 && !container.textContent?.trim()) {
        pdfError('[PDFExport] Container is empty after HTML insertion!');
        Alert.alert('Ошибка', 'Не удалось вставить содержимое в контейнер');
        return;
      }

      // Ждем загрузки изображений
      setProgress(50);
      await waitForImages(container);

      setProgress(80);

      // ✅ ИСПРАВЛЕНИЕ: Нормализуем настройки, чтобы избежать undefined
      const format = (bookSettings?.format || 'A4').toLowerCase();
      const orientation = bookSettings?.orientation || 'portrait';
      const margins = bookSettings?.margins || 'standard';
      const imageQuality = bookSettings?.imageQuality || 'high';
      const title = bookSettings?.title || 'Мои путешествия';

      // Генерируем и сохраняем PDF
      const filename = `${title.replace(/[^a-zа-яё0-9]/gi, '_')}_${new Date().toISOString().split('T')[0]}.pdf`;
      
      await saveHtmlAsPdf(container, {
        filename,
        margin: margins === 'narrow' ? [5, 5, 7, 5] : 
                margins === 'wide' ? [15, 15, 20, 15] : 
                [10, 10, 14, 10],
        image: {
          type: 'jpeg' as const,
          quality: imageQuality === 'high' ? 0.95 : 
                  imageQuality === 'medium' ? 0.85 : 0.75,
        },
        html2canvas: {
          useCORS: true,
          backgroundColor: '#ffffff',
          scale: 2,
        },
        jsPDF: {
          unit: 'mm' as const,
          format: format as any,
          orientation: orientation as 'portrait' | 'landscape',
        },
      });

      setProgress(100);
      
      // Удаляем контейнер
      if (container.parentNode) {
        container.parentNode.removeChild(container);
      }

      Alert.alert('Успешно!', `PDF-фотоальбом "${bookSettings.title}" успешно создан и сохранен`);
    } catch (error: any) {
      pdfError('[PDFExport] Error:', error);
      
      // Улучшенная обработка ошибок с понятными сообщениями
      let errorMessage = 'Произошла ошибка при создании PDF. Попробуйте еще раз.';
      let errorTitle = 'Ошибка создания PDF';
      
      if (error?.message) {
        if (error.message.includes('CORS') || error.message.includes('image')) {
          errorTitle = 'Ошибка загрузки изображений';
          errorMessage = 'Некоторые изображения не удалось загрузить. Проверьте интернет-соединение и попробуйте еще раз.';
        } else if (error.message.includes('memory') || error.message.includes('Memory')) {
          errorTitle = 'Недостаточно памяти';
          errorMessage = 'Выбрано слишком много путешествий. Попробуйте выбрать меньше путешествий для экспорта.';
        } else if (error.message.includes('timeout') || error.message.includes('Timeout')) {
          errorTitle = 'Превышено время ожидания';
          errorMessage = 'Операция заняла слишком много времени. Попробуйте выбрать меньше путешествий или проверьте интернет-соединение.';
        }
      }
      
      Alert.alert(errorTitle, errorMessage);
    } finally {
      setIsGenerating(false);
      setProgress(0);
      if (containerRef.current && containerRef.current.parentNode) {
        containerRef.current.parentNode.removeChild(containerRef.current);
      }
    }
  }, [selected]);

  const previewPDF = useCallback(async (bookSettings: BookSettings) => {
    if (!selected.length) {
      Alert.alert('Внимание', 'Пожалуйста, выберите хотя бы одно путешествие');
      return;
    }

    if (Platform.OS !== 'web') {
      Alert.alert('Недоступно', 'Превью PDF доступно только в веб-версии');
      return;
    }

    setIsGenerating(true);
    setProgress(0);

    let container: HTMLDivElement | null = null;
    let iframe: HTMLIFrameElement | null = null;
    let closeBtn: HTMLButtonElement | null = null;
    let blobUrl: string | null = null;

    try {
      // ✅ ИСПРАВЛЕНИЕ: Проверяем, что данные не пустые
      pdfLog('[PDFPreview] Selected travels:', selected.length, selected);
      
      // Преобразуем данные в формат для книги
      pdfLog('[PDFPreview] Raw selected travels:', selected.length, selected.map(t => ({
        id: t.id,
        name: t.name,
        hasDescription: !!t.description,
        descriptionType: typeof t.description,
        descriptionLength: t.description?.length,
        hasGallery: !!t.gallery,
        galleryType: typeof t.gallery,
        galleryLength: Array.isArray(t.gallery) ? t.gallery.length : 0,
      })));
      
      const travelsForBook: TravelForBook[] = selected.map(convertTravelToBookFormat);
      pdfLog('[PDFPreview] Converted travels:', travelsForBook.length, travelsForBook.map(t => ({
        id: t.id,
        name: t.name,
        hasDescription: !!t.description,
        descriptionType: typeof t.description,
        descriptionLength: t.description?.length,
        hasGallery: !!t.gallery,
        galleryType: typeof t.gallery,
        galleryLength: Array.isArray(t.gallery) ? t.gallery.length : 0,
      })));
      
      // ✅ ОТЛАДКА: Проверяем наличие описаний и галерей (только в dev)
      travelsForBook.forEach((travel, idx) => {
        pdfLog(`[PDFPreview] Travel ${idx + 1} (${travel.name}):`, {
          hasDescription: !!travel.description,
          descriptionLength: travel.description?.length || 0,
          hasRecommendation: !!travel.recommendation,
          hasPlus: !!travel.plus,
          hasMinus: !!travel.minus,
          galleryLength: travel.gallery?.length || 0,
          gallery: travel.gallery,
        });
      });

      if (travelsForBook.length === 0) {
        Alert.alert('Ошибка', 'Не удалось преобразовать данные путешествий');
        return;
      }

      // ✅ ИСПРАВЛЕНИЕ: Контейнер должен быть видимым для html2canvas, но скрыт от пользователя
      // Используем opacity и pointer-events вместо left: -9999px, чтобы html2canvas мог видеть контент
      container = document.createElement('div');
      container.style.position = 'fixed';
      container.style.left = '0';
      container.style.top = '0';
      container.style.width = '210mm';
      container.style.minHeight = '297mm';
      container.style.backgroundColor = '#fff';
      container.style.overflow = 'visible';
      container.style.opacity = '0';
      container.style.pointerEvents = 'none';
      container.style.zIndex = '-1';
      // ✅ КРИТИЧНО: Контейнер должен быть в DOM и видимым для html2canvas
      // Но мы делаем его невидимым через opacity, а не через left: -9999px
      document.body.appendChild(container);

      setProgress(10);

      const html = await buildPhotoBookHTML(travelsForBook, bookSettings);
      pdfLog('[PDFPreview] Generated HTML length:', html.length);
      
      if (!html || html.trim().length === 0) {
        Alert.alert('Ошибка', 'Не удалось сгенерировать содержимое для превью');
        return;
      }

      setProgress(40);

      // ✅ ИСПРАВЛЕНИЕ: Извлекаем только содержимое body из полного HTML
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, 'text/html');
      const bodyContent = doc.body.innerHTML;
      const headStyles = doc.head.querySelectorAll('style');
      
      pdfLog('[PDFPreview] Body content length:', bodyContent.length);
      pdfLog('[PDFPreview] Styles found:', headStyles.length);
      
      // Очищаем контейнер перед вставкой
      container.innerHTML = '';
      
      // Вставляем стили в контейнер
      if (headStyles.length > 0) {
        const styleElement = document.createElement('style');
        styleElement.textContent = Array.from(headStyles).map(s => s.textContent).join('\n');
        container.appendChild(styleElement);
        pdfLog('[PDFPreview] Styles inserted, length:', styleElement.textContent.length);
      }
      
      // Вставляем содержимое body
      container.innerHTML = bodyContent;
      
      pdfLog('[PDFPreview] Container innerHTML length:', container.innerHTML.length);
      pdfLog('[PDFPreview] Container children:', container.children.length);
      pdfLog('[PDFPreview] Container text content length:', container.textContent?.length || 0);
      
      // ✅ ИСПРАВЛЕНИЕ: Проверяем, что контент действительно вставлен
      if (container.children.length === 0 && !container.textContent?.trim()) {
        pdfError('[PDFPreview] Container is empty after HTML insertion!');
        pdfError('[PDFPreview] HTML was:', html.substring(0, 1000));
        Alert.alert('Ошибка', 'Не удалось вставить содержимое в контейнер');
        return;
      }
      
      // ✅ КРИТИЧНО: Делаем контейнер видимым для html2canvas
      // Контейнер должен быть в DOM и видимым для html2canvas, но не мешать пользователю
      // Используем position: fixed с left: -9999px вместо z-index: -1, чтобы html2canvas мог видеть контент
      container.style.opacity = '1';
      container.style.position = 'fixed';
      container.style.left = '-9999px';
      container.style.top = '0';
      container.style.width = '210mm';
      container.style.height = 'auto';
      container.style.backgroundColor = '#fff';
      container.style.overflow = 'visible';
      container.style.zIndex = '1'; // Положительный z-index для html2canvas
      container.style.visibility = 'visible';
      
      // Принудительно вызываем reflow для применения стилей
      void container.offsetHeight;

      setProgress(50);
      
      // ✅ ИСПРАВЛЕНИЕ: Ждем полной загрузки изображений и рендеринга
      await waitForImages(container);
      
      // ✅ ИСПРАВЛЕНИЕ: Дополнительная задержка для полного рендеринга
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // ✅ КРИТИЧНО: Проверяем, что контент действительно отрендерен
      const sections = container.querySelectorAll('.pdf-page');
      pdfLog('[PDFPreview] Found PDF pages:', sections.length);
      if (sections.length === 0) {
        pdfError('[PDFPreview] No PDF pages found in container!');
        pdfError('[PDFPreview] Container HTML:', container.innerHTML.substring(0, 2000));
        Alert.alert('Ошибка', 'Контент не отрендерился. Проверьте консоль для деталей.');
        return;
      }

      setProgress(80);

      // ✅ КРИТИЧНО: Вычисляем реальные размеры контейнера
      const containerWidth = container.scrollWidth || container.offsetWidth || 794; // 210mm в пикселях при 96 DPI
      const containerHeight = container.scrollHeight || container.offsetHeight || 1123; // 297mm в пикселях при 96 DPI
      
      pdfLog('[PDFPreview] Container dimensions:', {
        scrollWidth: container.scrollWidth,
        scrollHeight: container.scrollHeight,
        offsetWidth: container.offsetWidth,
        offsetHeight: container.offsetHeight,
        computedWidth: containerWidth,
        computedHeight: containerHeight,
      });
      
      // ✅ ИСПРАВЛЕНИЕ: Проверяем, что html2pdf доступен
      if (typeof window === 'undefined' || !window.html2pdf) {
        pdfError('[PDFPreview] html2pdf is not available');
        Alert.alert('Ошибка', 'Библиотека для генерации PDF не загружена. Попробуйте обновить страницу.');
        return;
      }
      
      // ✅ ИСПРАВЛЕНИЕ: Проверяем и нормализуем настройки, чтобы избежать undefined
      // ✅ КРИТИЧНО: Убеждаемся что все значения определены и валидны
      const format = (() => {
        const fmt = bookSettings?.format || 'A4';
        if (typeof fmt !== 'string') return 'a4';
        const lower = fmt.toLowerCase();
        return ['a4', 'letter', 'legal', 'tabloid', 'ledger', 'a3', 'a5'].includes(lower) ? lower : 'a4';
      })();
      
      const orientation = (() => {
        const orient = bookSettings?.orientation || 'portrait';
        if (typeof orient !== 'string') return 'portrait';
        const lower = orient.toLowerCase();
        return (lower === 'landscape' || lower === 'l') ? 'landscape' : 'portrait';
      })();
      
      const margins = bookSettings?.margins || 'standard';
      const imageQuality = bookSettings?.imageQuality || 'high';
      
      // ✅ КРИТИЧНО: Проверяем что контейнер не пустой и имеет размеры
      if (!container || container.children.length === 0) {
        pdfError('[PDFPreview] Container is empty or invalid');
        Alert.alert('Ошибка', 'Контент для превью пуст. Проверьте выбранные путешествия.');
        return;
      }
      
      if (containerWidth <= 0 || containerHeight <= 0) {
        pdfError('[PDFPreview] Container has invalid dimensions:', { containerWidth, containerHeight });
        Alert.alert('Ошибка', 'Не удалось определить размеры контента для превью.');
        return;
      }
      
      pdfLog('[PDFPreview] Starting PDF generation with html2pdf...', {
        format,
        orientation,
        margins,
        imageQuality,
        containerWidth,
        containerHeight,
        containerChildren: container.children.length,
      });
      
      // ✅ КРИТИЧНО: Улучшенные настройки для html2canvas с проверкой всех значений
      const blob = await getPdfBlob(container, {
        margin: margins === 'narrow' ? [5, 5, 7, 5] : 
                margins === 'wide' ? [15, 15, 20, 15] : 
                [10, 10, 14, 10],
        image: {
          type: 'jpeg' as const,
          quality: imageQuality === 'high' ? 0.95 : 
                  imageQuality === 'medium' ? 0.85 : 0.75,
        },
        html2canvas: {
          useCORS: true,
          allowTaint: false,
          backgroundColor: '#ffffff',
          scale: 2,
          logging: true, // Включаем логирование для отладки
          width: containerWidth || 794,
          height: containerHeight || 1123,
          windowWidth: containerWidth || 794,
          windowHeight: containerHeight || 1123,
          x: 0,
          y: 0,
          scrollX: 0,
          scrollY: 0,
          // ✅ КРИТИЧНО: Убеждаемся, что html2canvas видит весь контент
          removeContainer: false,
        },
        jsPDF: {
          unit: 'mm' as const,
          format: format as any,
          orientation: orientation as 'portrait' | 'landscape',
        },
      });

      pdfLog('[PDFPreview] Generated blob:', blob.size, 'bytes');

      if (!blob || blob.size === 0) {
        pdfError('[PDFPreview] Generated blob is empty!');
        Alert.alert('Ошибка', 'PDF пуст. Проверьте данные путешествий.');
        return;
      }

      // ✅ Скрываем контейнер после генерации
      if (container) {
        container.style.opacity = '0';
        container.style.pointerEvents = 'none';
      }

      setProgress(100);

      blobUrl = URL.createObjectURL(blob);
      
      // ✅ ИСПРАВЛЕНИЕ: Открываем в iframe для превью
      iframe = document.createElement('iframe');
      iframe.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;border:none;z-index:9998;background:#fff;';
      iframe.src = blobUrl;

      closeBtn = document.createElement('button');
      closeBtn.style.cssText = 'position:fixed;top:20px;right:20px;z-index:9999;padding:12px 24px;background:#ff9f5a;color:#fff;border:none;border-radius:8px;cursor:pointer;font-weight:600;box-shadow:0 4px 12px rgba(0,0,0,0.2);';
      closeBtn.textContent = 'Закрыть';
      
      const cleanup = () => {
        if (iframe && iframe.parentNode) iframe.parentNode.removeChild(iframe);
        if (closeBtn && closeBtn.parentNode) closeBtn.parentNode.removeChild(closeBtn);
        if (blobUrl) URL.revokeObjectURL(blobUrl);
        // ✅ ИСПРАВЛЕНИЕ: Удаляем контейнер только при закрытии
        if (container && container.parentNode) container.parentNode.removeChild(container);
        iframe = null;
        closeBtn = null;
        container = null;
        blobUrl = null;
      };
      
      closeBtn.onclick = cleanup;

      document.body.appendChild(iframe);
      document.body.appendChild(closeBtn);

      // ✅ ИСПРАВЛЕНИЕ: Не удаляем контейнер сразу - он нужен для превью
      // Удалим его только при закрытии
    } catch (error) {
      pdfError('[PDFPreview] Error:', error);
      Alert.alert('Ошибка', `Произошла ошибка при создании превью: ${error instanceof Error ? error.message : 'Неизвестная ошибка'}`);
      
      // ✅ ИСПРАВЛЕНИЕ: Очищаем ресурсы при ошибке
      if (container && container.parentNode) container.parentNode.removeChild(container);
      if (iframe && iframe.parentNode) iframe.parentNode.removeChild(iframe);
      if (closeBtn && closeBtn.parentNode) closeBtn.parentNode.removeChild(closeBtn);
      if (blobUrl) URL.revokeObjectURL(blobUrl);
    } finally {
      setIsGenerating(false);
      setProgress(0);
    }
  }, [selected]);

  const handleSave = useCallback((bookSettings: BookSettings) => {
    setSettings(bookSettings);
    generatePDF(bookSettings);
  }, [generatePDF]);

  const handlePreview = useCallback((bookSettings: BookSettings) => {
    previewPDF(bookSettings);
  }, [previewPDF]);

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

// Вспомогательная функция для ожидания загрузки изображений
function waitForImages(container: HTMLElement): Promise<void> {
  return new Promise((resolve) => {
    const images = container.querySelectorAll('img');
    pdfLog('[waitForImages] Found images:', images.length);
    
    if (images.length === 0) {
      pdfLog('[waitForImages] No images found, resolving immediately');
      resolve();
      return;
    }

    let loaded = 0;
    let errored = 0;
    const total = images.length;

    const checkComplete = () => {
      pdfLog(`[waitForImages] Progress: ${loaded} loaded, ${errored} errored, ${total} total`);
      if (loaded + errored >= total) {
        pdfLog('[waitForImages] All images processed');
        resolve();
      }
    };

    images.forEach((img, index) => {
      // ✅ ИСПРАВЛЕНИЕ: Устанавливаем crossOrigin для CORS
      if (!img.hasAttribute('crossorigin')) {
        img.crossOrigin = 'anonymous';
      }
      
      // ✅ ИСПРАВЛЕНИЕ: Обрабатываем ошибки загрузки изображений
      if (img.complete && img.naturalHeight !== 0) {
        loaded++;
        pdfLog(`[waitForImages] Image ${index} already loaded`);
        checkComplete();
      } else {
        img.onload = () => {
          loaded++;
          pdfLog(`[waitForImages] Image ${index} loaded successfully`);
          checkComplete();
        };
        img.onerror = (e) => {
          errored++;
          pdfWarn(`[waitForImages] Image ${index} failed to load:`, img.src, e);
          // ✅ ИСПРАВЛЕНИЕ: Заменяем на placeholder при ошибке
          img.style.display = 'none';
          const placeholder = document.createElement('div');
          placeholder.style.cssText = 'width: 100%; height: 200px; background: linear-gradient(135deg, #f3f4f6 0%, #e5e7eb 100%); display: flex; align-items: center; justify-content: center; color: #9ca3af; font-size: 14pt;';
          placeholder.textContent = 'Изображение недоступно';
          img.parentNode?.insertBefore(placeholder, img);
          checkComplete();
        };
      }
    });

    // Таймаут на случай, если изображения не загрузятся
    setTimeout(() => {
      pdfLog('[waitForImages] Timeout reached, resolving');
      resolve();
    }, 30000); // 30 секунд максимум
  });
}

