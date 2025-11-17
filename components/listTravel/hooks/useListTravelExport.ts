/**
 * Кастомный хук для управления экспортом в PDF
 * Вынесена логика экспорта для переиспользования и тестирования
 */

import React, { useState, useRef, useCallback } from 'react';
import { Platform, Alert } from 'react-native';
import { saveContainerAsPDF, renderPreviewToBlobURL } from '@/src/utils/pdfWeb';
import type { Travel } from '@/src/types/types';

export interface UseListTravelExportReturn {
  selected: Travel[];
  printRef: React.RefObject<HTMLDivElement>;
  toggleSelect: (travel: Travel) => void;
  toggleSelectAll: (travels: Travel[]) => void;
  clearSelection: () => void;
  isSelected: (id: number | string) => boolean;
  makePreview: () => Promise<void>;
  savePdf: () => Promise<void>;
}

/**
 * ✅ АРХИТЕКТУРА: Хук для управления экспортом в PDF
 * 
 * Логика:
 * - Управление выбранными элементами
 * - Генерация PDF preview
 * - Сохранение PDF
 */
export function useListTravelExport(): UseListTravelExportReturn {
  const [selected, setSelected] = useState<Travel[]>([]);
  const printRef = useRef<HTMLDivElement>(null);

  // ✅ АРХИТЕКТУРА: Переключение выбора элемента
  const toggleSelect = useCallback((travel: Travel) => {
    setSelected((prev) =>
      prev.find((x) => x.id === travel.id) 
        ? prev.filter((x) => x.id !== travel.id) 
        : [...prev, travel]
    );
  }, []);

  // ✅ АРХИТЕКТУРА: Выбор всех элементов
  const toggleSelectAll = useCallback((travels: Travel[]) => {
    if (!travels.length) return;
    setSelected((prev) => (prev.length === travels.length ? [] : travels));
  }, []);

  // ✅ АРХИТЕКТУРА: Очистка выбора
  const clearSelection = useCallback(() => {
    setSelected([]);
  }, []);

  // ✅ АРХИТЕКТУРА: Проверка выбора элемента
  const isSelected = useCallback((id: number | string) => {
    return selected.some((s) => s.id === id);
  }, [selected]);

  // ✅ АРХИТЕКТУРА: Генерация PDF preview
  const makePreview = useCallback(async () => {
    if (!selected.length) return;
    if (Platform.OS !== "web") {
      Alert.alert("Недоступно", "Превью PDF доступно только в веб-версии.");
      return;
    }
    if (!printRef.current) return;

    let statusEl: HTMLDivElement | null = document.createElement("div");
    let iframe: HTMLIFrameElement | null = null;
    let closeBtn: HTMLButtonElement | null = null;

    try {
      statusEl.style.cssText =
        "position:fixed;top:0;left:0;right:0;padding:20px;background:#6b8e7f;color:#fff;text-align:center;z-index:9999;";
      statusEl.textContent = "Генерируем PDF, подождите...";
      document.body.appendChild(statusEl);

      const url = await renderPreviewToBlobURL(printRef.current, {
        filename: "metravel.pdf",
      });

      if (url) {
        iframe = document.createElement("iframe");
        iframe.style.cssText =
          "position:fixed;top:0;left:0;width:100%;height:100%;border:none;z-index:9998;";
        iframe.src = url;

        closeBtn = document.createElement("button");
        closeBtn.style.cssText =
          "position:fixed;top:20px;right:20px;z-index:9999;padding:10px 20px;background:#fff;color:#6b8e7f;border:none;border-radius:4px;cursor:pointer;";
        closeBtn.textContent = "Закрыть";
        closeBtn.onclick = () => {
          if (iframe && document.body.contains(iframe)) document.body.removeChild(iframe);
          if (closeBtn && document.body.contains(closeBtn)) document.body.removeChild(closeBtn);
          if (statusEl && document.body.contains(statusEl)) document.body.removeChild(statusEl);
          URL.revokeObjectURL(url);
        };

        document.body.appendChild(iframe);
        document.body.appendChild(closeBtn);
        if (statusEl && statusEl.parentNode) document.body.removeChild(statusEl);
        statusEl = null;
      }
    } catch (e) {
      console.error("[PDFExport] preview error:", e);
      if (statusEl) {
        statusEl.textContent = "Ошибка при создании превью";
        statusEl.style.background = "#a00";
        setTimeout(() => {
          if (statusEl && statusEl.parentNode) document.body.removeChild(statusEl);
        }, 3000);
      }
      if (iframe && document.body.contains(iframe)) document.body.removeChild(iframe);
      if (closeBtn && document.body.contains(closeBtn)) document.body.removeChild(closeBtn);
    }
  }, [selected]);

  // ✅ АРХИТЕКТУРА: Сохранение PDF
  const savePdf = useCallback(async () => {
    if (!selected.length) {
      Alert.alert("Внимание", "Пожалуйста, выберите хотя бы одно путешествие");
      return;
    }
    if (Platform.OS !== "web") {
      Alert.alert("Недоступно", "Сохранение PDF доступно только в веб-версии.");
      return;
    }
    if (!printRef.current) return;

    let bar: HTMLDivElement | null = document.createElement("div");
    bar.style.cssText =
      "position:fixed;top:0;left:0;right:0;padding:20px;background:#6b8e7f;color:#fff;text-align:center;z-index:9999;";
    bar.textContent = "Создание PDF...";
    document.body.appendChild(bar);
    
    try {
      await saveContainerAsPDF(printRef.current, "my-travels.pdf", {
        margin: [10, 10],
        image: { type: "jpeg", quality: 0.95 },
      });
    } catch (e) {
      console.error("PDF generation error:", e);
      Alert.alert("Ошибка", "Ошибка при создании PDF");
    } finally {
      if (bar && bar.parentNode) document.body.removeChild(bar);
      bar = null;
    }
  }, [selected]);

  return {
    selected,
    printRef,
    toggleSelect,
    toggleSelectAll,
    clearSelection,
    isSelected,
    makePreview,
    savePdf,
  };
}

