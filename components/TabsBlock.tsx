// components/TabsBlock.tsx
// ✅ РЕДИЗАЙН: Блок вкладок для переключения между разделами

import React, { useState, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Platform } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { DESIGN_TOKENS } from '@/constants/designSystem';

interface Tab {
  id: string;
  label: string;
  icon?: string;
  badge?: number;
  onPress?: () => void;
  isActive?: boolean;
}

interface TabsBlockProps {
  tabs: Tab[];
  compact?: boolean;
  horizontal?: boolean; // Для мобильной версии
}

const palette = DESIGN_TOKENS.colors;
const spacing = DESIGN_TOKENS.spacing;
const radii = DESIGN_TOKENS.radii;

export default function TabsBlock({ tabs, compact = false, horizontal = false }: TabsBlockProps) {
  const scrollViewRef = useRef<ScrollView>(null);
  const [activeTab, setActiveTab] = useState(tabs.find(t => t.isActive)?.id || tabs[0]?.id);

  const handleTabPress = (tab: Tab) => {
    setActiveTab(tab.id);
    tab.onPress?.();
  };

  if (compact) {
    return (
      <View style={styles.compactContainer}>
        <Text style={styles.compactText}>
          {tabs.find(t => t.id === activeTab)?.label || 'Вкладки'}
        </Text>
      </View>
    );
  }

  if (horizontal) {
    return (
      <ScrollView
        ref={scrollViewRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.horizontalContainer}
        style={styles.horizontalScroll}
      >
        {tabs.map((tab) => {
          const isActive = tab.id === activeTab;
          return (
            <Pressable
              key={tab.id}
              style={[styles.horizontalTab, isActive && styles.horizontalTabActive]}
              onPress={() => handleTabPress(tab)}
              accessibilityRole="tab"
              accessibilityState={{ selected: isActive }}
              accessibilityLabel={tab.label}
              {...Platform.select({
                web: {
                  cursor: 'pointer',
                },
              })}
            >
              {tab.icon && (
                <Feather 
                  name={tab.icon as any} 
                  size={16} 
                  color={isActive ? palette.primary : palette.textMuted} 
                />
              )}
              <Text style={[styles.horizontalTabText, isActive && styles.horizontalTabTextActive]}>
                {tab.label}
              </Text>
              {tab.badge !== undefined && tab.badge > 0 && (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{tab.badge}</Text>
                </View>
              )}
            </Pressable>
          );
        })}
      </ScrollView>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.tabsContainer}>
        {tabs.map((tab) => {
          const isActive = tab.id === activeTab;
          return (
            <Pressable
              key={tab.id}
              style={[styles.tab, isActive && styles.tabActive]}
              onPress={() => handleTabPress(tab)}
              accessibilityRole="tab"
              accessibilityState={{ selected: isActive }}
              accessibilityLabel={tab.label}
              {...Platform.select({
                web: {
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  // @ts-ignore
                  ':hover': {
                    backgroundColor: palette.primarySoft,
                  },
                },
              })}
            >
              {tab.icon && (
                <Feather 
                  name={tab.icon as any} 
                  size={18} 
                  color={isActive ? palette.primary : palette.textMuted} 
                  style={styles.tabIcon}
                />
              )}
              <Text style={[styles.tabText, isActive && styles.tabTextActive]}>
                {tab.label}
              </Text>
              {tab.badge !== undefined && tab.badge > 0 && (
                <View style={[styles.badge, isActive && styles.badgeActive]}>
                  <Text style={styles.badgeText}>{tab.badge}</Text>
                </View>
              )}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: palette.surface,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: palette.border,
    padding: spacing.sm,
    ...Platform.select({
      web: {
        boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
      },
      default: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 2,
        elevation: 1,
      },
    }),
  },
  tabsContainer: {
    flexDirection: 'row',
    gap: spacing.xs,
    flexWrap: 'wrap',
  },
  tab: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radii.md,
    backgroundColor: palette.surfaceMuted,
    minHeight: 40,
    ...Platform.select({
      web: {
        transition: 'all 0.2s ease',
      },
    }),
  },
  tabActive: {
    backgroundColor: palette.primarySoft,
    borderWidth: 1,
    borderColor: palette.primary,
  },
  tabIcon: {
    marginRight: spacing.xs,
  },
  tabText: {
    fontSize: 14,
    fontWeight: '500',
    color: palette.textMuted,
  },
  tabTextActive: {
    color: palette.primary,
    fontWeight: '600',
  },
  badge: {
    backgroundColor: palette.textMuted,
    borderRadius: radii.full,
    paddingHorizontal: 6,
    paddingVertical: 2,
    minWidth: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeActive: {
    backgroundColor: palette.primary,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#fff',
  },
  horizontalScroll: {
    marginHorizontal: -spacing.md,
  },
  horizontalContainer: {
    paddingHorizontal: spacing.md,
    gap: spacing.sm,
  },
  horizontalTab: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radii.md,
    backgroundColor: palette.surfaceMuted,
    minHeight: 40,
    ...Platform.select({
      web: {
        transition: 'all 0.2s ease',
        cursor: 'pointer',
        // @ts-ignore
        ':hover': {
          backgroundColor: palette.primarySoft,
        },
      },
    }),
  },
  horizontalTabActive: {
    backgroundColor: palette.primarySoft,
    borderWidth: 1,
    borderColor: palette.primary,
  },
  horizontalTabText: {
    fontSize: 14,
    fontWeight: '500',
    color: palette.textMuted,
  },
  horizontalTabTextActive: {
    color: palette.primary,
    fontWeight: '600',
  },
  compactContainer: {
    padding: spacing.sm,
    backgroundColor: palette.surfaceMuted,
    borderRadius: radii.md,
  },
  compactText: {
    fontSize: 12,
    color: palette.textMuted,
  },
});

