// components/export/constructor/PageNavigationBar.tsx
// ✅ АРХИТЕКТУРА: Панель навигации по страницам в конструкторе PDF

import React, { useState } from 'react';
import { Text } from 'react-native';
import { Tooltip } from './Tooltip';

interface PageNavigationBarProps {
  currentPageIndex: number; // 0-based
  totalPages: number;
  onPreviousPage: () => void;
  onNextPage: () => void;
  onGoToPage?: (pageIndex: number) => void; // 0-based
}

export function PageNavigationBar({
  currentPageIndex,
  totalPages,
  onPreviousPage,
  onNextPage,
  onGoToPage,
}: PageNavigationBarProps) {
  const [isEditingPage, setIsEditingPage] = useState(false);
  const [pageInput, setPageInput] = useState(String(currentPageIndex + 1));

  const currentPage = currentPageIndex + 1;
  const canGoPrevious = currentPageIndex > 0;
  const canGoNext = currentPageIndex < totalPages - 1;

  const handlePageInputChange = (value: string) => {
    // Разрешаем только цифры
    const numValue = value.replace(/[^0-9]/g, '');
    if (numValue === '' || (parseInt(numValue, 10) >= 1 && parseInt(numValue, 10) <= totalPages)) {
      setPageInput(numValue);
    }
  };

  const handlePageInputSubmit = () => {
    const pageNum = parseInt(pageInput, 10);
    if (pageNum >= 1 && pageNum <= totalPages && onGoToPage) {
      onGoToPage(pageNum - 1); // Конвертируем в 0-based индекс
    } else {
      // Восстанавливаем текущую страницу, если ввод невалидный
      setPageInput(String(currentPage));
    }
    setIsEditingPage(false);
  };

  const handlePageIndicatorClick = () => {
    if (onGoToPage && totalPages > 1) {
      setIsEditingPage(true);
    }
  };

  // Синхронизируем input с текущей страницей, когда не редактируем
  React.useEffect(() => {
    if (!isEditingPage) {
      setPageInput(String(currentPage));
    }
  }, [currentPage, isEditingPage]);

  return (
    <div style={styles.container}>
      {/* Кнопка "Предыдущая" */}
      <Tooltip text="Предыдущая страница (Page Up)">
        <div
          onClick={canGoPrevious ? onPreviousPage : undefined}
          style={{
            ...styles.navButton,
            ...(!canGoPrevious ? styles.navButtonDisabled : {}),
          } as React.CSSProperties}
        >
          <span style={styles.navButtonIcon}>◀</span>
        </div>
      </Tooltip>

      {/* Индикатор страницы */}
      <div style={styles.pageIndicator}>
        {isEditingPage && onGoToPage ? (
          <input
            type="text"
            value={pageInput}
            onChange={(e) => handlePageInputChange(e.target.value)}
            onBlur={handlePageInputSubmit}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                handlePageInputSubmit();
              } else if (e.key === 'Escape') {
                setIsEditingPage(false);
                setPageInput(String(currentPage));
              }
            }}
            style={styles.pageInput}
            autoFocus
            aria-label="Номер страницы"
          />
        ) : (
          <div
            onClick={onGoToPage && totalPages > 1 ? handlePageIndicatorClick : undefined}
            style={{
              ...styles.pageIndicatorText,
              ...(onGoToPage && totalPages > 1 ? styles.pageIndicatorClickable : {}),
            } as React.CSSProperties}
            title={onGoToPage && totalPages > 1 ? 'Нажмите для перехода к странице' : undefined}
          >
            <Text style={styles.pageIndicatorTextContent}>
              Страница {currentPage} из {totalPages}
            </Text>
          </div>
        )}
      </div>

      {/* Кнопка "Следующая" */}
      <Tooltip text="Следующая страница (Page Down)">
        <div
          onClick={canGoNext ? onNextPage : undefined}
          style={{
            ...styles.navButton,
            ...(!canGoNext ? styles.navButtonDisabled : {}),
          } as React.CSSProperties}
        >
          <span style={styles.navButtonIcon}>▶</span>
        </div>
      </Tooltip>
    </div>
  );
}

const styles = {
  container: {
    display: 'flex',
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    gap: 12,
    padding: '12px 16px',
    backgroundColor: '#ffffff',
    borderBottom: '1px solid #e5e7eb',
    boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
  },
  navButton: {
    display: 'flex',
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    width: 36,
    height: 36,
    borderRadius: 6,
    backgroundColor: '#f3f4f6',
    cursor: 'pointer',
    transition: 'all 0.2s',
  },
  navButtonDisabled: {
    opacity: 0.4,
    cursor: 'not-allowed' as const,
  },
  navButtonIcon: {
    fontSize: 18,
    lineHeight: 1,
    color: '#1f2937',
  },
  pageIndicator: {
    display: 'flex',
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    minWidth: 140,
  },
  pageIndicatorText: {
    padding: '6px 12px',
    borderRadius: 6,
    transition: 'all 0.2s',
  },
  pageIndicatorClickable: {
    cursor: 'pointer',
    backgroundColor: '#f9fafb',
  },
  pageIndicatorTextContent: {
    fontSize: 14,
    fontWeight: '500' as const,
    color: '#374151',
    userSelect: 'none' as const,
  },
  pageInput: {
    width: 60,
    padding: '6px 8px',
    borderRadius: 6,
    border: '2px solid #ff9f5a',
    fontSize: 14,
    fontWeight: '500' as const,
    textAlign: 'center' as const,
    outline: 'none',
    backgroundColor: '#ffffff',
  },
} as const;

