// Modern TravelCard - Using the new design system
// Demonstrates modern React patterns and atomic design

import React, { memo, useMemo, useCallback } from 'react';
import { Platform } from 'react-native';
import { TravelCard, designTokens } from '../ui';
import type { Travel } from '../../types/types';

// Modern TravelCard wrapper that integrates with existing logic
interface ModernTravelCardProps {
  travel: Travel;
  cardWidth?: number;
  isSelected?: boolean;
  isFirst?: boolean;
  selectable?: boolean;
  canEdit?: boolean;
  canDelete?: boolean;
  onPress?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  onToggleSelect?: () => void;
}

export const ModernTravelCard = memo<ModernTravelCardProps>(({
  travel,
  cardWidth,
  isSelected = false,
  isFirst = false,
  selectable = false,
  canEdit = false,
  canDelete = false,
  onPress,
  onEdit,
  onDelete,
  onToggleSelect,
}) => {
  // Transform legacy travel object to modern format
  const modernTravel = useMemo(() => ({
    id: travel.id,
    slug: travel.slug,
    name: travel.name,
    travel_image_thumb_url: travel.travel_image_thumb_url,
    countryName: travel.countryName,
    userName: travel.userName,
    countUnicIpView: travel.countUnicIpView,
    created_at: (travel as any).created_at,
    updated_at: (travel as any).updated_at,
  }), [travel]);

  // Modern event handlers with proper TypeScript
  const handlePress = useCallback(() => {
    if (selectable) {
      onToggleSelect?.();
    } else {
      onPress?.();
    }
  }, [selectable, onToggleSelect, onPress]);

  const handleEdit = useCallback((e?: any) => {
    e?.stopPropagation?.();
    onEdit?.();
  }, [onEdit]);

  const handleDelete = useCallback((e?: any) => {
    e?.stopPropagation?.();
    onDelete?.();
  }, [onDelete]);

  const handleToggleSelect = useCallback((e?: any) => {
    e?.stopPropagation?.();
    onToggleSelect?.();
  }, [onToggleSelect]);

  return (
    <TravelCard
      travel={modernTravel}
      cardWidth={cardWidth}
      isSelected={isSelected}
      isFirst={isFirst}
      selectable={selectable}
      canEdit={canEdit}
      canDelete={canDelete}
      onPress={handlePress}
      onEdit={handleEdit}
      onDelete={handleDelete}
      onToggleSelect={handleToggleSelect}
      style={{
        // Responsive width based on cardWidth prop
        ...(cardWidth && Platform.OS === 'web' && {
          width: cardWidth,
          maxWidth: cardWidth,
        }),
      }}
    />
  );
});

// Display name for debugging
ModernTravelCard.displayName = 'ModernTravelCard';

// Legacy TravelListItem compatibility layer
// This allows gradual migration from the old component
export const TravelListItem = ModernTravelCard;
