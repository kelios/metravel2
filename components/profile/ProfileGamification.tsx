import React, { memo } from 'react';
import { View, Text, StyleSheet, ScrollView, Platform } from 'react-native';
import { DESIGN_TOKENS } from '@/constants/designSystem';
import AuthorProgress from '@/components/gamification/AuthorProgress';
import BadgeSystem from '@/components/gamification/BadgeSystem';

interface ProfileGamificationProps {
  userId?: string;
}

const ProfileGamification = ({ userId }: ProfileGamificationProps) => {
  return (
    <View style={styles.container}>
      <Text style={styles.sectionTitle}>🎯 Твой прогресс</Text>
      
      {/* Прогресс автора */}
      <View style={styles.section}>
        <AuthorProgress userId={userId} />
      </View>

      {/* Достижения */}
      <View style={styles.section}>
        <BadgeSystem userId={userId} />
      </View>

      {/* Статистика */}
      <View style={styles.section}>
        <Text style={styles.subsectionTitle}>📊 Статистика</Text>
        <View style={styles.statsGrid}>
          <StatCard icon="📝" label="Статей" value="0" />
          <StatCard icon="📸" label="Фото" value="0" />
          <StatCard icon="🗺️" label="Маршрутов" value="0" />
          <StatCard icon="❤️" label="Лайков" value="0" />
        </View>
      </View>
    </View>
  );
};

interface StatCardProps {
  icon: string;
  label: string;
  value: string;
}

const StatCard = memo(({ icon, label, value }: StatCardProps) => (
  <View style={styles.statCard}>
    <Text style={styles.statIcon}>{icon}</Text>
    <Text style={styles.statValue}>{value}</Text>
    <Text style={styles.statLabel}>{label}</Text>
  </View>
));

const styles = StyleSheet.create({
  container: {
    gap: 24,
    paddingVertical: 16,
  },
  sectionTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: DESIGN_TOKENS.colors.text,
    marginBottom: 8,
  },
  section: {
    gap: 16,
  },
  subsectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: DESIGN_TOKENS.colors.text,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  statCard: {
    flex: 1,
    minWidth: Platform.select({ default: 150, web: 160 }),
    backgroundColor: DESIGN_TOKENS.colors.surface,
    borderRadius: DESIGN_TOKENS.radii.md,
    padding: 16,
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: DESIGN_TOKENS.colors.border,
    ...Platform.select({
      web: {
        boxShadow: '0 2px 4px rgba(0, 0, 0, 0.05)',
      },
    }),
  },
  statIcon: {
    fontSize: 32,
  },
  statValue: {
    fontSize: 24,
    fontWeight: '700',
    color: DESIGN_TOKENS.colors.text,
  },
  statLabel: {
    fontSize: 13,
    fontWeight: '500',
    color: DESIGN_TOKENS.colors.textMuted,
  },
});

export default memo(ProfileGamification);
