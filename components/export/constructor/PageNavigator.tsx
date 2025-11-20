// components/export/constructor/PageNavigator.tsx
// ✅ АРХИТЕКТУРА: Навигатор страниц

import React from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView } from 'react-native';
import type { PdfPage } from '@/src/types/pdf-constructor';

interface PageNavigatorProps {
  pages: PdfPage[];
  currentPageId: string | null;
  onSelectPage: (pageId: string) => void;
  onDeletePage: (pageId: string) => void;
  onDuplicatePage: (pageId: string) => void;
}

export function PageNavigator({
  pages,
  currentPageId,
  onSelectPage,
  onDeletePage,
  onDuplicatePage,
}: PageNavigatorProps) {
  return (
    <div
      style={{
        width: 200,
        backgroundColor: '#fff',
        borderRight: '1px solid #e0e0e0',
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
      }}
    >
      <View style={styles.header}>
        <Text style={styles.title}>Страницы</Text>
        <Text style={styles.count}>{pages.length}</Text>
      </View>

      <ScrollView style={styles.list}>
        {pages.map((page) => (
          <div
            key={page.id}
            style={{
              padding: 12,
              backgroundColor: page.id === currentPageId ? '#f0f9ff' : '#fff',
              borderLeft: page.id === currentPageId ? '3px solid #ff9f5a' : '3px solid transparent',
              cursor: 'pointer',
              borderBottom: '1px solid #e0e0e0',
            }}
            onClick={() => onSelectPage(page.id)}
          >
            <Text style={styles.pageNumber}>Страница {page.pageNumber}</Text>
            <Text style={styles.pageInfo}>
              {page.blocks.length} блоков
            </Text>
            <div style={styles.actions}>
              <Pressable
                onPress={(e) => {
                  e.stopPropagation();
                  onDuplicatePage(page.id);
                }}
                style={styles.actionButton}
              >
                <Text style={styles.actionButtonText}>📋</Text>
              </Pressable>
              {pages.length > 1 && (
                <Pressable
                  onPress={(e) => {
                    e.stopPropagation();
                    if (confirm('Удалить страницу?')) {
                      onDeletePage(page.id);
                    }
                  }}
                  style={styles.actionButton}
                >
                  <Text style={styles.actionButtonText}>🗑️</Text>
                </Pressable>
              )}
            </div>
          </div>
        ))}
      </ScrollView>
    </div>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1a202c',
  },
  count: {
    fontSize: 14,
    color: '#6b7280',
  },
  list: {
    flex: 1,
  },
  pageNumber: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1a202c',
    marginBottom: 4,
  },
  pageInfo: {
    fontSize: 12,
    color: '#6b7280',
    marginBottom: 8,
  },
  actions: {
    flexDirection: 'row',
    gap: 4,
  },
  actionButton: {
    padding: 4,
    borderRadius: 4,
    backgroundColor: '#f3f4f6',
  },
  actionButtonText: {
    fontSize: 14,
  },
});

