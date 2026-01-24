import React from 'react';
import { Text, View } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import { Icon } from '@/src/ui/paper';
import type { ModerationIssue } from '@/utils/formValidation';
import CardActionPressable from '@/components/ui/CardActionPressable';

type ChecklistItem = {
  key: string;
  label: string;
  detail?: string;
  benefit?: string;
  ok: boolean;
};

interface PublishChecklistCardProps {
  colors: any;
  styles: any;
  checklist: ChecklistItem[];
  requiredChecklist: ChecklistItem[];
  recommendedChecklist: ChecklistItem[];
  moderationIssuesByKey: Map<string, ModerationIssue>;
  onNavigateToIssue?: (issue: ModerationIssue) => void;
}

const PublishChecklistCard: React.FC<PublishChecklistCardProps> = ({
  colors,
  styles,
  checklist,
  requiredChecklist,
  recommendedChecklist,
  moderationIssuesByKey,
  onNavigateToIssue,
}) => {
  return (
    <View style={[styles.card, styles.checklistCard]}>
      <View style={styles.checklistHeader}>
        <Text style={styles.cardTitle}>Готовность к публикации</Text>
        <View style={styles.progressRing}>
          <Text style={styles.progressRingText}>
            {checklist.filter((item) => item.ok).length}/{checklist.length}
          </Text>
        </View>
      </View>

      <View style={styles.checklistSection}>
        <View style={styles.sectionHeaderRow}>
          <Feather name="check-circle" size={16} color={colors.success} />
          <Text style={styles.sectionHeaderText}>Обязательно для публикации</Text>
        </View>
        {requiredChecklist.map((item) => {
          const issue = moderationIssuesByKey.get(item.key);
          const isClickable = !item.ok && !!issue && !!onNavigateToIssue;

          const rowContent = (
            <>
              <View
                style={[
                  styles.checkBadge,
                  item.ok ? styles.checkBadgeOk : styles.checkBadgeMissing,
                ]}
              >
                <Icon
                  source={item.ok ? 'check' : 'alert-circle'}
                  size={16}
                  color={item.ok ? colors.successDark : colors.dangerDark}
                />
              </View>
              <View style={styles.checklistTextColumn}>
                <Text
                  style={[
                    styles.checklistLabel,
                    isClickable && styles.checklistLabelClickable,
                    item.ok && styles.checklistLabelComplete,
                  ]}
                >
                  {item.label}
                </Text>
                <Text style={styles.checklistDetail}>{item.detail}</Text>
                {isClickable && !item.ok && (
                  <Text style={styles.checklistHint}>Нажмите, чтобы перейти</Text>
                )}
              </View>
              {isClickable && !item.ok && (
                <Icon source="chevron-right" size={16} color={colors.textMuted} />
              )}
            </>
          );

          const rowStyle = [
            styles.checklistRow,
            isClickable && styles.checklistRowClickable,
            item.ok && styles.checklistRowComplete,
          ];

          if (isClickable) {
            return (
              <CardActionPressable
                key={item.key}
                style={rowStyle}
                onPress={() => onNavigateToIssue?.(issue)}
                accessibilityLabel={item.label}
              >
                {rowContent}
              </CardActionPressable>
            );
          }

          return (
            <View key={item.key} style={rowStyle}>
              {rowContent}
            </View>
          );
        })}
      </View>

      <View style={[styles.checklistSection, styles.checklistSectionRecommended]}>
        <View style={styles.sectionHeaderRow}>
          <Feather name="info" size={16} color={colors.primary} />
          <Text style={styles.sectionHeaderText}>Рекомендуем заполнить</Text>
        </View>
        {recommendedChecklist.map((item) => {
          const issue = moderationIssuesByKey.get(item.key);
          const isClickable = !item.ok && !!issue && !!onNavigateToIssue;

          const rowContent = (
            <>
              <View
                style={[
                  styles.checkBadge,
                  item.ok ? styles.checkBadgeOk : styles.checkBadgeRecommended,
                ]}
              >
                <Icon
                  source={item.ok ? 'check' : 'star-outline'}
                  size={16}
                  color={item.ok ? colors.successDark : colors.primary}
                />
              </View>
              <View style={styles.checklistTextColumn}>
                <Text
                  style={[
                    styles.checklistLabel,
                    isClickable && styles.checklistLabelClickable,
                    item.ok && styles.checklistLabelComplete,
                  ]}
                >
                  {item.label}
                </Text>
                <Text style={styles.checklistDetail}>{item.detail}</Text>
                {item.benefit && <Text style={styles.benefitText}>{item.benefit}</Text>}
                {isClickable && !item.ok && (
                  <Text style={styles.checklistHint}>Нажмите, чтобы перейти</Text>
                )}
              </View>
              {isClickable && !item.ok && (
                <Icon source="chevron-right" size={16} color={colors.textMuted} />
              )}
            </>
          );

          const rowStyle = [
            styles.checklistRow,
            isClickable && styles.checklistRowClickable,
            item.ok && styles.checklistRowComplete,
          ];

          if (isClickable) {
            return (
              <CardActionPressable
                key={item.key}
                style={rowStyle}
                onPress={() => onNavigateToIssue?.(issue)}
                accessibilityLabel={item.label}
              >
                {rowContent}
              </CardActionPressable>
            );
          }

          return (
            <View key={item.key} style={rowStyle}>
              {rowContent}
            </View>
          );
        })}
      </View>
    </View>
  );
};

export default React.memo(PublishChecklistCard);
