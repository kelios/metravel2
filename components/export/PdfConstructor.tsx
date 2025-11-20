// components/export/PdfConstructor.tsx
// ✅ АРХИТЕКТУРА: Визуальный конструктор PDF

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { View, Text, StyleSheet, Platform, ScrollView, Pressable, Modal } from 'react-native';
import type { PdfDocument, PdfPage, PdfBlock, BlockType, PageFormat, PageOrientation } from '@/src/types/pdf-constructor';
import { ArticleConstructorService } from '@/src/services/pdf-export/constructor/ArticleConstructorService';
import { themeManager } from '@/src/services/pdf-export/constructor/themes/ThemeManager';
import { PdfDocumentBuilder } from '@/src/services/pdf-export/constructor/PdfDocumentBuilder';
import { HistoryManager } from '@/src/services/pdf-export/constructor/HistoryManager';
import { ClipboardManager } from '@/src/services/pdf-export/constructor/ClipboardManager';
import { BlockPalette } from './constructor/BlockPalette';
import { BlockPaletteImproved } from './constructor/BlockPaletteImproved';
import { Toolbar } from './constructor/Toolbar';
import { PageCanvas } from './constructor/PageCanvas';
import { StylePanel } from './constructor/StylePanel';
import { StylePanelImproved } from './constructor/StylePanelImproved';
import { PageNavigator } from './constructor/PageNavigator';
import { PageNavigatorImproved } from './constructor/PageNavigatorImproved';
import { PageNavigationBar } from './constructor/PageNavigationBar';
import { ContextMenu } from './constructor/ContextMenu';
import { Tooltip } from './constructor/Tooltip';
import { Notification } from './constructor/Notification';
import { PageSettingsPanel } from './constructor/PageSettingsPanel';
import { EditModeIndicator } from './constructor/EditModeIndicator';
import { HelpPanel } from './constructor/HelpPanel';

interface PdfConstructorProps {
  travelId?: string;
  travelData?: any;
  onExport?: (blob: Blob, filename: string) => void;
  onClose?: () => void;
}

export default function PdfConstructor({
  travelId,
  travelData,
  onExport,
  onClose,
}: PdfConstructorProps) {
  const [service] = useState(() => new ArticleConstructorService());
  const [historyManager] = useState(() => new HistoryManager());
  const [clipboardManager] = useState(() => ClipboardManager.getInstance());
  const [document, setDocument] = useState<PdfDocument | null>(null);
  const [currentPageId, setCurrentPageId] = useState<string | null>(null);
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null);
  const [editingBlockId, setEditingBlockId] = useState<string | null>(null);
  const [showBlockPalette, setShowBlockPalette] = useState(false);
  const [showStylePanel, setShowStylePanel] = useState(false);
  const [showPageSettings, setShowPageSettings] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; blockId: string } | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);
  const [exportMessage, setExportMessage] = useState('');
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'info' | 'warning' | 'error' } | null>(null);

  // Инициализация документа
  useEffect(() => {
    let doc: PdfDocument;
    if (travelData) {
      doc = service.importArticle(travelData, 'light');
    } else {
      doc = service.createDocument('Новый документ', 'A4');
      if (doc.pages.length === 0) {
        service['builder'].addPage();
        doc = service.getDocument();
      }
    }
    setDocument(doc);
    historyManager.initialize(doc);
    
    // Пытаемся загрузить историю из localStorage
    if (doc.id) {
      const loaded = historyManager.loadFromLocalStorage(doc.id);
      if (loaded) {
        const restoredDoc = historyManager.redo();
        if (restoredDoc) {
          setDocument(restoredDoc);
          service['builder'].loadDocument(restoredDoc);
        }
      }
    }
    
    if (doc.pages.length > 0) {
      setCurrentPageId(doc.pages[0].id);
    }
  }, [travelData, service, historyManager]);

  // Получаем текущую страницу
  const currentPage = document?.pages.find((p) => p.id === currentPageId) || null;
  const selectedBlock = currentPage?.blocks.find((b) => b.id === selectedBlockId) || null;

  // Закрытие контекстного меню при клике вне его
  useEffect(() => {
    if (!contextMenu) return;

    const handleClickOutside = () => {
      setContextMenu(null);
    };

    // Небольшая задержка, чтобы не закрыть меню сразу после открытия
    const timeout = setTimeout(() => {
      window.addEventListener('click', handleClickOutside);
    }, 100);

    return () => {
      clearTimeout(timeout);
      window.removeEventListener('click', handleClickOutside);
    };
  }, [contextMenu]);

  // Обработчики
  const handleAddBlock = useCallback((type: BlockType) => {
    if (!currentPageId) return;

    const builder = service['builder'] as PdfDocumentBuilder;
    const format = document?.format || 'A4';
    const width = format === 'A4' ? 210 : format === 'A5' ? 148 : 105;
    const height = format === 'A4' ? 297 : format === 'A5' ? 210 : 148;

    const block: Omit<PdfBlock, 'id'> = {
      type,
      position: { x: 20, y: 50, width: width - 40, height: 30, unit: 'mm' },
      styles: {},
      content: getDefaultContentForBlock(type),
    };

    builder.addBlock(currentPageId, block);
    const updatedDoc = service.getDocument();
    setDocument(updatedDoc);
    historyManager.push(updatedDoc);
    
    // Сохраняем историю
    if (document?.id) {
      historyManager.saveToLocalStorage(document.id);
    }
    
    setShowBlockPalette(false);
  }, [currentPageId, document, service, historyManager]);

  const handleSelectBlock = useCallback((blockId: string) => {
    setSelectedBlockId(blockId);
    setShowStylePanel(true);
    setEditingBlockId(null); // Завершаем редактирование при выборе другого блока
    setContextMenu(null); // Закрываем контекстное меню
  }, []);

  const handleContextMenu = useCallback((e: React.MouseEvent, blockId: string) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({ x: e.clientX, y: e.clientY, blockId });
    setSelectedBlockId(blockId);
  }, []);

  const handleCopyBlock = useCallback(() => {
    if (!selectedBlockId || !currentPage) return;
    const block = currentPage.blocks.find(b => b.id === selectedBlockId);
    if (block) {
      clipboardManager.copy(block);
      setNotification({ message: 'Блок скопирован', type: 'success' });
    }
  }, [selectedBlockId, currentPage, clipboardManager]);

  const handlePasteBlock = useCallback(() => {
    if (!currentPageId) return;
    const pastedBlock = clipboardManager.paste();
    if (pastedBlock) {
      const builder = service['builder'] as PdfDocumentBuilder;
      builder.addBlock(currentPageId, pastedBlock);
      const updatedDoc = service.getDocument();
      setDocument(updatedDoc);
      historyManager.push(updatedDoc);
      setSelectedBlockId(pastedBlock.id);
      setNotification({ message: 'Блок вставлен', type: 'success' });
      
      // Сохраняем историю
      if (document?.id) {
        historyManager.saveToLocalStorage(document.id);
      }
    } else {
      setNotification({ message: 'Буфер обмена пуст', type: 'warning' });
    }
  }, [currentPageId, document, clipboardManager, service, historyManager]);

  const handleDuplicateBlock = useCallback(() => {
    if (!currentPageId || !selectedBlockId || !currentPage) return;
    
    const block = currentPage.blocks.find(b => b.id === selectedBlockId);
    if (!block) return;

    const builder = service['builder'] as PdfDocumentBuilder;
    const duplicatedBlock: Omit<PdfBlock, 'id'> = {
      ...block,
      position: {
        ...block.position,
        x: block.position.x + 10,
        y: block.position.y + 10,
      },
    };
    
    const addedBlock = builder.addBlock(currentPageId, duplicatedBlock);
    const updatedDoc = service.getDocument();
    setDocument(updatedDoc);
    historyManager.push(updatedDoc);
    
    // Сохраняем историю
    if (document?.id) {
      historyManager.saveToLocalStorage(document.id);
    }
    
    setSelectedBlockId(addedBlock?.id || null);
    setNotification({ message: 'Блок продублирован', type: 'success' });
  }, [currentPageId, selectedBlockId, currentPage, document, service, historyManager]);

  const handleStartEdit = useCallback((blockId: string) => {
    setEditingBlockId(blockId);
    setSelectedBlockId(blockId);
  }, []);

  const handleEndEdit = useCallback((blockId: string, text: string) => {
    if (!currentPageId) return;

    const builder = service['builder'] as PdfDocumentBuilder;
    builder.updateBlock(currentPageId, blockId, { content: text });
    const updatedDoc = service.getDocument();
    setDocument(updatedDoc);
    historyManager.push(updatedDoc);
    
    // Сохраняем историю
    if (document?.id) {
      historyManager.saveToLocalStorage(document.id);
    }
    
    setEditingBlockId(null);
  }, [currentPageId, document, service, historyManager]);

  const handleUpdateBlock = useCallback((blockId: string, updates: Partial<PdfBlock>) => {
    if (!currentPageId) return;

    const builder = service['builder'] as PdfDocumentBuilder;
    builder.updateBlock(currentPageId, blockId, updates);
    const updatedDoc = service.getDocument();
    setDocument(updatedDoc);
    historyManager.push(updatedDoc);
    
    // Сохраняем историю в localStorage
    if (document?.id) {
      historyManager.saveToLocalStorage(document.id);
    }
  }, [currentPageId, document, service, historyManager]);

  const handleDeleteBlock = useCallback(() => {
    if (!currentPageId || !selectedBlockId) return;

    const builder = service['builder'] as PdfDocumentBuilder;
    builder.removeBlock(currentPageId, selectedBlockId);
    const updatedDoc = service.getDocument();
    setDocument(updatedDoc);
    historyManager.push(updatedDoc);
    setSelectedBlockId(null);
    setShowStylePanel(false);
    
    // Сохраняем историю
    if (document?.id) {
      historyManager.saveToLocalStorage(document.id);
    }
    
    setNotification({ message: 'Блок удален', type: 'info' });
  }, [currentPageId, selectedBlockId, document, service, historyManager]);

  const handleUndo = useCallback(() => {
    const doc = historyManager.undo();
    if (doc) {
      setDocument(doc);
      // Восстанавливаем состояние через сервис
      service['builder'].loadDocument(doc);
      
      // Сохраняем историю
      if (doc.id) {
        historyManager.saveToLocalStorage(doc.id);
      }
    }
  }, [historyManager, service]);

  const handleRedo = useCallback(() => {
    const doc = historyManager.redo();
    if (doc) {
      setDocument(doc);
      service['builder'].loadDocument(doc);
      
      // Сохраняем историю
      if (doc.id) {
        historyManager.saveToLocalStorage(doc.id);
      }
    }
  }, [historyManager, service]);

  const handleUpdatePageSettings = useCallback((format: PageFormat, orientation: PageOrientation, scaleBlocks: boolean) => {
    if (!document) return;

    const builder = service['builder'] as PdfDocumentBuilder;
    builder.updateDocumentFormat(format, orientation, scaleBlocks);
    const updatedDoc = service.getDocument();
    setDocument(updatedDoc);
    historyManager.push(updatedDoc);
    
    // Сохраняем историю в localStorage
    historyManager.saveToLocalStorage(document.id);
  }, [document, service, historyManager]);

  const handleAddPage = useCallback(() => {
    const builder = service['builder'] as PdfDocumentBuilder;
    const page = builder.addPage();
    const updatedDoc = service.getDocument();
    setDocument(updatedDoc);
    historyManager.push(updatedDoc);
    
    // Сохраняем историю
    if (document?.id) {
      historyManager.saveToLocalStorage(document.id);
    }
    
    setCurrentPageId(page.id);
  }, [document, service, historyManager]);

  const handleDeletePage = useCallback((pageId: string) => {
    const builder = service['builder'] as PdfDocumentBuilder;
    builder.removePage(pageId);
    const doc = service.getDocument();
    setDocument(doc);
    historyManager.push(doc);
    
    // Сохраняем историю
    if (document?.id) {
      historyManager.saveToLocalStorage(document.id);
    }
    
    if (doc.pages.length > 0) {
      setCurrentPageId(doc.pages[0].id);
    } else {
      setCurrentPageId(null);
    }
    setNotification({ message: 'Страница удалена', type: 'info' });
  }, [document, service, historyManager]);

  const handleDuplicatePage = useCallback((pageId: string) => {
    const builder = service['builder'] as PdfDocumentBuilder;
    const page = builder.duplicatePage(pageId);
    if (page) {
      const updatedDoc = service.getDocument();
      setDocument(updatedDoc);
      historyManager.push(updatedDoc);
      
      // Сохраняем историю
      if (document?.id) {
        historyManager.saveToLocalStorage(document.id);
      }
      
      setCurrentPageId(page.id);
      setNotification({ message: 'Страница продублирована', type: 'success' });
    }
  }, [document, service, historyManager]);

  const handleChangeTheme = useCallback((themeId: string) => {
    const theme = themeManager.getTheme(themeId);
    if (theme && document) {
      const builder = service['builder'] as PdfDocumentBuilder;
      builder.setTheme(theme);
      const updatedDoc = service.getDocument();
      setDocument(updatedDoc);
      historyManager.push(updatedDoc);
      
      // Сохраняем историю
      if (document.id) {
        historyManager.saveToLocalStorage(document.id);
      }
      
      setNotification({ message: `Тема изменена на "${theme.name}"`, type: 'success' });
    }
  }, [document, service, historyManager]);

  // Навигация по страницам
  const currentPageIndex = document?.pages.findIndex((p) => p.id === currentPageId) ?? -1;
  const totalPages = document?.pages.length ?? 0;

  const handlePreviousPage = useCallback(() => {
    if (!document || currentPageIndex <= 0) return;
    const previousPage = document.pages[currentPageIndex - 1];
    if (previousPage) {
      setCurrentPageId(previousPage.id);
    }
  }, [document, currentPageIndex]);

  const handleNextPage = useCallback(() => {
    if (!document || currentPageIndex >= totalPages - 1) return;
    const nextPage = document.pages[currentPageIndex + 1];
    if (nextPage) {
      setCurrentPageId(nextPage.id);
    }
  }, [document, currentPageIndex, totalPages]);

  const handleGoToPage = useCallback((pageIndex: number) => {
    if (!document || pageIndex < 0 || pageIndex >= document.pages.length) return;
    const page = document.pages[pageIndex];
    if (page) {
      setCurrentPageId(page.id);
    }
  }, [document]);

  const handleGoToFirstPage = useCallback(() => {
    if (!document || document.pages.length === 0) return;
    setCurrentPageId(document.pages[0].id);
  }, [document]);

  const handleGoToLastPage = useCallback(() => {
    if (!document || document.pages.length === 0) return;
    const lastPage = document.pages[document.pages.length - 1];
    setCurrentPageId(lastPage.id);
  }, [document]);

  // Обработка горячих клавиш (после объявления всех обработчиков)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Проверяем, не редактируется ли текст в блоке
      // Используем window.document, чтобы избежать конфликта с локальной переменной document
      const activeElement = window.document.activeElement;
      const isEditingText =
        activeElement &&
        (activeElement.tagName === 'INPUT' ||
          activeElement.tagName === 'TEXTAREA' ||
          (activeElement as HTMLElement).contentEditable === 'true');

      // Если редактируется текст, не обрабатываем навигацию по страницам
      if (isEditingText && (e.key === 'PageUp' || e.key === 'PageDown' || e.key === 'Home' || e.key === 'End')) {
        return; // Позволяем браузеру обработать стандартное поведение для текстовых полей
      }

      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        handleUndo();
      } else if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
        e.preventDefault();
        handleRedo();
      } else if ((e.ctrlKey || e.metaKey) && e.key === 'c' && selectedBlockId && currentPage) {
        e.preventDefault();
        const block = currentPage.blocks.find(b => b.id === selectedBlockId);
        if (block) {
          clipboardManager.copy(block);
        }
      } else if ((e.ctrlKey || e.metaKey) && e.key === 'v' && currentPageId) {
        e.preventDefault();
        handlePasteBlock();
      } else if (e.key === 'Delete' && selectedBlockId) {
        e.preventDefault();
        handleDeleteBlock();
      } else if (e.key === 'PageUp' || ((e.ctrlKey || e.metaKey) && e.key === 'ArrowLeft')) {
        // Предыдущая страница: Page Up или Ctrl+←
        e.preventDefault();
        handlePreviousPage();
      } else if (e.key === 'PageDown' || ((e.ctrlKey || e.metaKey) && e.key === 'ArrowRight')) {
        // Следующая страница: Page Down или Ctrl+→
        e.preventDefault();
        handleNextPage();
      } else if (e.key === 'Home' && (e.ctrlKey || e.metaKey)) {
        // Первая страница: Ctrl+Home
        e.preventDefault();
        handleGoToFirstPage();
      } else if (e.key === 'End' && (e.ctrlKey || e.metaKey)) {
        // Последняя страница: Ctrl+End
        e.preventDefault();
        handleGoToLastPage();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [
    selectedBlockId,
    currentPage,
    currentPageId,
    clipboardManager,
    handleUndo,
    handleRedo,
    handlePasteBlock,
    handleDeleteBlock,
    handlePreviousPage,
    handleNextPage,
    handleGoToFirstPage,
    handleGoToLastPage,
  ]);

  const handleExportLayout = useCallback(() => {
    if (!document) return;
    
    const builder = service['builder'] as PdfDocumentBuilder;
    const json = builder.exportToJSON();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = window.document.createElement('a');
    link.href = url;
    link.download = `${document.title.replace(/[^a-zа-яё0-9]/gi, '_')}_layout.json`;
    window.document.body.appendChild(link);
    link.click();
    window.document.body.removeChild(link);
    URL.revokeObjectURL(url);
    
    setNotification({ message: 'Макет экспортирован', type: 'success' });
  }, [document, service]);

  const handleImportLayout = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const json = e.target?.result as string;
        const builder = service['builder'] as PdfDocumentBuilder;
        const success = builder.importFromJSON(json);
        
        if (success) {
          const importedDoc = builder.getDocument();
          setDocument(importedDoc);
          historyManager.initialize(importedDoc);
          if (importedDoc.pages.length > 0) {
            setCurrentPageId(importedDoc.pages[0].id);
          }
          setNotification({ message: 'Макет импортирован', type: 'success' });
        } else {
          setNotification({ message: 'Ошибка импорта макета', type: 'error' });
        }
      } catch (error) {
        setNotification({ message: 'Ошибка чтения файла', type: 'error' });
      }
    };
    reader.readAsText(file);
    
    // Сбрасываем input для возможности повторного выбора того же файла
    event.target.value = '';
  }, [service, historyManager]);

  const handleExport = useCallback(async () => {
    setIsExporting(true);
    setExportProgress(0);
    setExportMessage('');

    try {
      const result = await service.exportToPdf(
        { dpi: 300, imageFormat: 'png' },
        (progress, message) => {
          setExportProgress(progress);
          setExportMessage(message);
        }
      );

      // Скачиваем файл
      const url = URL.createObjectURL(result.blob);
      const link = window.document.createElement('a');
      link.href = url;
      link.download = result.filename;
      window.document.body.appendChild(link);
      link.click();
      window.document.body.removeChild(link);
      URL.revokeObjectURL(url);

      onExport?.(result.blob, result.filename);
    } catch (error) {
      // ✅ BUG-001: Логируем ошибки экспорта
      if (__DEV__) {
        console.error('Export failed:', error);
      }
      alert(`Ошибка экспорта: ${error instanceof Error ? error.message : 'Неизвестная ошибка'}`);
    } finally {
      setIsExporting(false);
    }
  }, [service, onExport]);

  if (Platform.OS !== 'web') {
    return (
      <View style={styles.container}>
        <Text>Конструктор PDF доступен только в веб-версии</Text>
      </View>
    );
  }

  if (!document || !currentPage) {
    return (
      <View style={styles.container}>
        <Text>Загрузка...</Text>
      </View>
    );
  }

  return (
    <div style={styles.webContainer}>
      {/* Верхняя панель */}
      <Toolbar
        onAddBlock={() => setShowBlockPalette(true)}
        onAddPage={handleAddPage}
        onPageSettings={() => setShowPageSettings(true)}
        onThemeChange={handleChangeTheme}
        currentThemeId={document.theme.id}
        themes={themeManager.getAllThemes()}
        onUndo={handleUndo}
        onRedo={handleRedo}
        canUndo={historyManager.canUndo()}
        canRedo={historyManager.canRedo()}
        onExportLayout={handleExportLayout}
        onImportLayout={() => {
          const input = window.document.createElement('input');
          input.type = 'file';
          input.accept = '.json';
          input.onchange = (e) => {
            const file = (e.target as HTMLInputElement).files?.[0];
            if (file) {
              const reader = new FileReader();
              reader.onload = (e) => {
                try {
                  const json = e.target?.result as string;
                  const builder = service['builder'] as PdfDocumentBuilder;
                  const success = builder.importFromJSON(json);
                  
                  if (success) {
                    const importedDoc = builder.getDocument();
                    setDocument(importedDoc);
                    historyManager.initialize(importedDoc);
                    if (importedDoc.pages.length > 0) {
                      setCurrentPageId(importedDoc.pages[0].id);
                    }
                    setNotification({ message: 'Макет импортирован', type: 'success' });
                  } else {
                    setNotification({ message: 'Ошибка импорта макета', type: 'error' });
                  }
                } catch (error) {
                  setNotification({ message: 'Ошибка чтения файла', type: 'error' });
                }
              };
              reader.readAsText(file);
            }
          };
          input.click();
        }}
        onExport={handleExport}
        isExporting={isExporting}
        exportProgress={exportProgress}
        onHelp={() => setShowHelp(true)}
        onClose={onClose}
      />

      {/* Основной контент */}
      <div style={styles.mainContent}>
        {/* Навигатор страниц */}
        <PageNavigatorImproved
          pages={document.pages}
          currentPageId={currentPageId}
          theme={document.theme}
          onSelectPage={setCurrentPageId}
          onDeletePage={handleDeletePage}
          onDuplicatePage={handleDuplicatePage}
        />

        {/* Холст страницы */}
        <div style={styles.canvasContainer}>
          {/* Панель навигации по страницам */}
          {totalPages > 0 && (
            <PageNavigationBar
              currentPageIndex={currentPageIndex}
              totalPages={totalPages}
              onPreviousPage={handlePreviousPage}
              onNextPage={handleNextPage}
              onGoToPage={handleGoToPage}
            />
          )}
          <PageCanvas
            page={currentPage}
            theme={document.theme}
            selectedBlockId={selectedBlockId}
            editingBlockId={editingBlockId}
            onSelectBlock={handleSelectBlock}
            onUpdateBlock={handleUpdateBlock}
            onStartEdit={handleStartEdit}
            onEndEdit={handleEndEdit}
            onDeleteBlock={handleDeleteBlock}
            onContextMenu={handleContextMenu}
          />
        </div>

        {/* Панель настроек страницы */}
        {showPageSettings && document && (
          <PageSettingsPanel
            format={document.format}
            orientation={document.orientation}
            onUpdate={handleUpdatePageSettings}
            onClose={() => setShowPageSettings(false)}
          />
        )}

        {/* Панель стилей */}
        {showStylePanel && selectedBlock && (
          <StylePanelImproved
            block={selectedBlock}
            theme={document.theme}
            onUpdate={(updates) => handleUpdateBlock(selectedBlock.id, updates)}
            onDelete={handleDeleteBlock}
            onClose={() => setShowStylePanel(false)}
          />
        )}
      </div>

      {/* Палитра блоков */}
      {showBlockPalette && (
        <BlockPaletteImproved
          onSelectBlock={handleAddBlock}
          onClose={() => setShowBlockPalette(false)}
        />
      )}

      {/* Контекстное меню */}
      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          onCopy={handleCopyBlock}
          onPaste={handlePasteBlock}
          onDelete={handleDeleteBlock}
          onDuplicate={handleDuplicateBlock}
          canPaste={clipboardManager.hasContent()}
          onClose={() => setContextMenu(null)}
        />
      )}

      {/* Индикатор режима редактирования */}
      <EditModeIndicator
        isEditing={!!editingBlockId}
        blockType={selectedBlock?.type}
      />

      {/* Уведомления */}
      {notification && (
        <Notification
          message={notification.message}
          type={notification.type}
          onClose={() => setNotification(null)}
        />
      )}

      {/* Прогресс экспорта */}
      {isExporting && (
        <div style={styles.progressOverlay}>
          <div style={styles.progressBox}>
            <Text style={styles.progressText}>{exportMessage}</Text>
            <div style={styles.progressBar}>
              <div style={{ ...styles.progressBarFill, width: `${exportProgress}%` } as React.CSSProperties} />
            </div>
          </div>
        </div>
      )}

      {/* Панель справки */}
      {showHelp && (
        <HelpPanel onClose={() => setShowHelp(false)} />
      )}
    </div>
  );
}

// Вспомогательная функция для получения контента по умолчанию
function getDefaultContentForBlock(type: BlockType): any {
  switch (type) {
    case 'heading-h1':
    case 'heading-h2':
    case 'heading-h3':
      return 'Заголовок';
    case 'paragraph':
      return 'Текст параграфа';
    case 'image':
      return { url: '', alt: '' };
    case 'image-gallery':
      return { images: [], columns: 2 };
    case 'spacer':
      return '';
    default:
      return '';
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  webContainer: {
    display: 'flex',
    flexDirection: 'column',
    height: '100vh',
    backgroundColor: '#f5f5f5',
  },
  toolbar: {
    display: 'flex',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#fff',
    borderBottom: '1px solid #e0e0e0',
    boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
  },
  toolbarLeft: {
    display: 'flex',
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  toolbarRight: {
    display: 'flex',
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  toolbarButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#ff9f5a',
    borderRadius: 6,
  },
  toolbarButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
  },
  themeSelect: {
    padding: 8,
    borderRadius: 6,
    border: '1px solid #e0e0e0',
    fontSize: 14,
  },
  exportButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: '#059669',
    borderRadius: 6,
  },
  exportButtonDisabled: {
    opacity: 0.6,
  },
  exportButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#f3f4f6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButtonText: {
    fontSize: 24,
    color: '#6b7280',
  },
  mainContent: {
    display: 'flex',
    flexDirection: 'row',
    flex: 1,
    overflow: 'hidden',
  },
  canvasContainer: {
    flex: 1,
    overflow: 'auto',
    padding: 20,
    backgroundColor: '#e5e5e5',
  },
  progressOverlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  progressBox: {
    backgroundColor: '#fff',
    padding: 24,
    borderRadius: 12,
    minWidth: 300,
  },
  progressText: {
    fontSize: 16,
    marginBottom: 16,
    textAlign: 'center',
  },
  progressBar: {
    height: 8,
    backgroundColor: '#e0e0e0',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#059669',
    transition: 'width 0.3s',
  },
});

