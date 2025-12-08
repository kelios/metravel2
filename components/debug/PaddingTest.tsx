// PaddingTest.tsx
// Тестовый компонент для проверки отступов карточек

import React from 'react';
import { View, Text, StyleSheet, ScrollView, Platform } from 'react-native';
import { DESIGN_TOKENS } from '@/constants/designSystem';

const spacing = DESIGN_TOKENS.spacing;

export default function PaddingTest() {
  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>Тест отступов карточек</Text>
      
      {/* Контейнер с padding как в ListTravel */}
      <View style={styles.listContainer}>
        <Text style={styles.subtitle}>ListTravel Container (paddingLeft: 10px, paddingRight: 14px)</Text>
        
        {/* Карточка 1 */}
        <View style={styles.card}>
          <View style={styles.cardInner}>
            <Text style={styles.cardText}>Карточка 1</Text>
            <Text style={styles.cardInfo}>width: 100%, maxWidth: 100%</Text>
          </View>
        </View>

        {/* Карточка 2 */}
        <View style={styles.card}>
          <View style={styles.cardInner}>
            <Text style={styles.cardText}>Карточка 2</Text>
            <Text style={styles.cardInfo}>border: 1px, borderRadius: 20px</Text>
          </View>
        </View>

        {/* Измерительная линейка */}
        <View style={styles.ruler}>
          <View style={styles.rulerLeft}>
            <Text style={styles.rulerText}>10px</Text>
          </View>
          <View style={styles.rulerCenter}>
            <Text style={styles.rulerText}>Контент</Text>
          </View>
          <View style={styles.rulerRight}>
            <Text style={styles.rulerText}>14px</Text>
          </View>
        </View>
      </View>

      {/* Информация о текущих значениях */}
      <View style={styles.info}>
        <Text style={styles.infoTitle}>Текущие значения:</Text>
        <Text style={styles.infoText}>spacing.sm = {spacing.sm}px</Text>
        <Text style={styles.infoText}>spacing.md = {spacing.md}px</Text>
        <Text style={styles.infoText}>Platform: {Platform.OS}</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    padding: 20,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    color: '#666',
    marginBottom: 10,
    fontWeight: '600',
  },
  listContainer: {
    backgroundColor: '#e0e0e0',
    paddingLeft: spacing.sm,
    paddingRight: spacing.md,
    paddingTop: spacing.sm,
    paddingBottom: spacing.sm,
    marginBottom: 20,
  },
  card: {
    width: '100%',
    maxWidth: '100%',
    marginBottom: spacing.sm,
    backgroundColor: '#ffffff',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.04)',
    overflow: 'hidden',
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.12,
        shadowRadius: 16,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  cardInner: {
    padding: 20,
  },
  cardText: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  cardInfo: {
    fontSize: 12,
    color: '#666',
  },
  ruler: {
    flexDirection: 'row',
    height: 40,
    marginTop: 20,
  },
  rulerLeft: {
    width: spacing.sm,
    backgroundColor: '#ff6b6b',
    justifyContent: 'center',
    alignItems: 'center',
  },
  rulerCenter: {
    flex: 1,
    backgroundColor: '#4ecdc4',
    justifyContent: 'center',
    alignItems: 'center',
  },
  rulerRight: {
    width: spacing.md,
    backgroundColor: '#ff6b6b',
    justifyContent: 'center',
    alignItems: 'center',
  },
  rulerText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#fff',
  },
  info: {
    backgroundColor: '#fff',
    padding: 20,
    margin: 20,
    borderRadius: 12,
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  infoText: {
    fontSize: 14,
    marginBottom: 5,
    fontFamily: Platform.select({ web: 'monospace', default: undefined }),
  },
});
