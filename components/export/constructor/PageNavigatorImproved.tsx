// components/export/constructor/PageNavigatorImproved.tsx
// ✅ АРХИТЕКТУРА: Улучшенный навигатор страниц с миниатюрами

import React, { useRef, useEffect } from 'react';
import { View, Text, ScrollView } from 'react-native';
import type { PdfPage, PdfTheme } from '@/src/types/pdf-constructor';
import { PAGE_FORMATS } from '@/src/types/pdf-constructor';
import { Tooltip } from './Tooltip';

interface PageNavigatorImprovedProps {
  pages: PdfPage[];
  currentPageId: string | null;
  theme: PdfTheme;
  onSelectPage: (pageId: string) => void;
  onDeletePage: (pageId: string) => void;
  onDuplicatePage: (pageId: string) => void;
}

export function PageNavigatorImproved({
  pages,
  currentPageId,
  theme,
  onSelectPage,
  onDeletePage,
  onDuplicatePage,
}: PageNavigatorImprovedProps) {
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const currentPageRef = useRef<HTMLDivElement | null>(null);

  // Автоматическая прокрутка к текущей странице
  useEffect(() => {
    if (currentPageRef.current && scrollContainerRef.current) {
      const container = scrollContainerRef.current;
      const pageElement = currentPageRef.current;

      const containerRect = container.getBoundingClientRect();
      const pageRect = pageElement.getBoundingClientRect();

      // Проверяем, видна ли страница в области видимости
      const isVisible =
        pageRect.top >= containerRect.top &&
        pageRect.bottom <= containerRect.bottom;

      if (!isVisible) {
        // Прокручиваем к странице с небольшим отступом сверху
        pageElement.scrollIntoView({
          behavior: 'smooth',
          block: 'nearest',
        });
      }
    }
  }, [currentPageId]);

  const renderPageThumbnail = (page: PdfPage) => {
    const format = PAGE_FORMATS[page.format];
    const width = page.orientation === 'landscape' ? format.height : format.width;
    const height = page.orientation === 'landscape' ? format.width : format.height;
    
    // Масштаб для миниатюры (примерно 50px ширина)
    const scale = 50 / width;
    const thumbWidth = width * scale;
    const thumbHeight = height * scale;

    const isCurrentPage = page.id === currentPageId;
    const pageRef = isCurrentPage ? currentPageRef : null;

    return (
      <div
        key={page.id}
        ref={pageRef}
        style={{
          padding: 12,
          backgroundColor: isCurrentPage ? '#f0f9ff' : '#fff',
          borderLeft: isCurrentPage ? '3px solid #ff9f5a' : '3px solid transparent',
          borderBottom: '1px solid #e0e0e0',
          cursor: 'pointer',
          transition: 'all 0.2s',
        }}
        onClick={() => onSelectPage(page.id)}
        onMouseEnter={(e) => {
          if (!isCurrentPage) {
            (e.currentTarget as HTMLElement).style.backgroundColor = '#f9fafb';
          }
        }}
        onMouseLeave={(e) => {
          if (!isCurrentPage) {
            (e.currentTarget as HTMLElement).style.backgroundColor = '#fff';
          }
        }}
        title="Нажмите, чтобы выбрать страницу"
      >
        {/* Миниатюра страницы */}
        <div
          style={{
            width: thumbWidth,
            height: thumbHeight,
            backgroundColor: page.background?.color || theme.colors.background,
            border: '1px solid #e5e7eb',
            borderRadius: 4,
            marginBottom: 8,
            position: 'relative',
            overflow: 'hidden',
            boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
          }}
        >
          {/* Индикатор блоков */}
          {page.blocks.length > 0 && (
            <div
              style={{
                position: 'absolute',
                top: 2,
                right: 2,
                backgroundColor: 'rgba(0,0,0,0.6)',
                color: '#fff',
                fontSize: 8,
                padding: '2px 4px',
                borderRadius: 2,
              }}
            >
              {page.blocks.length}
            </div>
          )}
        </div>

        {/* Информация о странице */}
        <Text style={styles.pageNumber}>Страница {page.pageNumber}</Text>
        <Text style={styles.pageInfo}>
          {page.blocks.length} {page.blocks.length === 1 ? 'блок' : page.blocks.length < 5 ? 'блока' : 'блоков'}
        </Text>

        {/* Действия */}
        <div style={styles.actions}>
              <Tooltip text="Дублировать страницу">
                <div
                  onClick={(e) => {
                    e.stopPropagation();
                    onDuplicatePage(page.id);
                  }}
                  style={styles.actionButton}
                >
                  <span style={styles.actionIcon}>📋</span>
                </div>
              </Tooltip>
              {pages.length > 1 && (
                <Tooltip text="Удалить страницу">
                  <div
                    onClick={(e) => {
                      e.stopPropagation();
                      if (confirm('Удалить страницу?')) {
                        onDeletePage(page.id);
                      }
                    }}
                    style={styles.actionButton}
                  >
                    <span style={styles.actionIcon}>🗑️</span>
                  </div>
                </Tooltip>
              )}
        </div>
      </div>
    );
  };

  return (
    <div
      style={{
        width: 220,
        backgroundColor: '#fff',
        borderRight: '1px solid #e0e0e0',
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
      }}
    >
      <div style={styles.header as React.CSSProperties}>
        <Text style={styles.title}>Страницы</Text>
        <div style={styles.badge as React.CSSProperties}>
          <Text style={styles.badgeText}>{pages.length}</Text>
        </div>
      </div>

      <div
        ref={scrollContainerRef}
        style={{ flex: 1, overflow: 'auto' } as React.CSSProperties}
      >
        {pages.map((page) => renderPageThumbnail(page))}
      </div>
    </div>
  );
}


const styles = {
  header: {
    flexDirection: 'row' as const,
    justifyContent: 'space-between' as const,
    alignItems: 'center' as const,
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  title: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: '#1a202c',
  },
  badge: {
    backgroundColor: '#ff9f5a',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 2,
    minWidth: 24,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: '#fff',
  },
  list: {
    flex: 1,
  },
  pageNumber: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: '#1a202c',
    marginBottom: 4,
  },
  pageInfo: {
    fontSize: 11,
    color: '#6b7280',
    marginBottom: 8,
  },
  actions: {
    display: 'flex',
    flexDirection: 'row' as const,
    gap: 4,
  },
  actionButton: {
    padding: 4,
    borderRadius: 4,
    backgroundColor: '#f3f4f6',
    cursor: 'pointer' as const,
    transition: 'all 0.2s',
  },
  actionIcon: {
    fontSize: 14,
  },
} as const;

