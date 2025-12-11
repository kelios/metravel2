// Atomic Design - Organisms
// Complex components that combine molecules and atoms

import React, { forwardRef, useMemo } from 'react';
import { View } from 'react-native';
import { TravelCard } from './molecules';

// ===== ORGANISMS =====

// TravelCard - Complex travel item display
interface TravelCardProps {
  travel: {
    id: number;
    slug?: string;
    name: string;
    travel_image_thumb_url?: string;
    countryName?: string;
    userName?: string;
    countUnicIpView?: number;
    created_at?: string;
    updated_at?: string;
  };
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
  style?: any;
}

export const TravelCardOrganism = forwardRef<View, TravelCardProps>(({
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
  style,
  ...props
}, ref) => {
  // Transform legacy travel object to modern format
  const modernTravel = useMemo(() => ({
    id: travel.id,
    slug: travel.slug,
    name: travel.name,
    travel_image_thumb_url: travel.travel_image_thumb_url,
    countryName: travel.countryName,
    userName: travel.userName,
    countUnicIpView: travel.countUnicIpView,
    created_at: travel.created_at,
    updated_at: travel.updated_at,
  }), [travel]);

  return (
    <TravelCard
      ref={ref}
      travel={modernTravel}
      cardWidth={cardWidth}
      isSelected={isSelected}
      isFirst={isFirst}
      selectable={selectable}
      canEdit={canEdit}
      canDelete={canDelete}
      onPress={onPress}
      onEdit={onEdit}
      onDelete={onDelete}
      onToggleSelect={onToggleSelect}
      style={style}
      {...props}
    />
  );
});