// Example: Modern ListTravel renderItem using new design system
// This shows how much cleaner the code becomes with atomic design

import React, { useCallback } from 'react';
import { FlatList, View } from 'react-native';
import { Box, Text, Button, Icon, designTokens } from '../ui';
import { ModernTravelCard } from '../ui/ModernTravelCard';
import type { Travel } from '../../types/types';

// Modern renderItem function - much cleaner!
const renderTravelItem = useCallback(({
  item: travel,
  index
}: {
  item: Travel;
  index: number;
}) => {
  // Simple, declarative code using design system components
  return (
    <Box
      key={`row-${index}`}
      flexDirection="row"
      gap={4}
      paddingVertical={2}
      style={{
        // Responsive grid layout
        flexWrap: 'wrap',
        justifyContent: 'flex-start',
      }}
    >
      {/* Modern TravelCard handles all the complex logic internally */}
      <ModernTravelCard
        travel={travel}
        cardWidth={280} // Design system handles responsive sizing
        isFirst={index === 0}
        canEdit={true} // Would come from props/context
        canDelete={true}
        onPress={() => console.log('Navigate to travel:', travel.id)}
        onEdit={() => console.log('Edit travel:', travel.id)}
        onDelete={() => console.log('Delete travel:', travel.id)}
      />
    </Box>
  );
}, []);

// Modern EmptyState using design system
const renderEmptyState = useCallback(({ showFilters, activeFiltersCount, onClearFilters }) => (
  <Box
    padding={8}
    alignItems="center"
    justifyContent="center"
    gap={4}
    style={{
      minHeight: 300,
    }}
  >
    <Icon name="search" size={48} color={designTokens.colors.neutral[400]} />

    <Box gap={2} alignItems="center">
      <Text variant="heading3" align="center">
        Ничего не найдено
      </Text>

      <Text
        variant="body"
        align="center"
        color={designTokens.colors.neutral[600]}
        style={{
          maxWidth: 400,
          lineHeight: 24,
        }}
      >
        Попробуйте изменить параметры поиска или сбросить фильтры
      </Text>
    </Box>

    {activeFiltersCount > 0 && (
      <Button
        variant="outline"
        onPress={onClearFilters}
        style={{
          marginTop: designTokens.spacing[4],
        }}
      >
        <Icon name="x" size={16} />
        <Text variant="label">
          Сбросить фильтры ({activeFiltersCount})
        </Text>
      </Button>
    )}
  </Box>
), []);

// Modern LoadingState
const renderLoadingState = useCallback(() => (
  <Box padding={4} gap={4}>
    {/* Skeleton loading cards */}
    {Array.from({ length: 6 }).map((_, index) => (
      <Box
        key={index}
        style={{
          height: 200,
          backgroundColor: designTokens.colors.neutral[100],
          borderRadius: designTokens.radius.lg,
          overflow: 'hidden',
        }}
      >
        <Box
          style={{
            height: '60%',
            backgroundColor: designTokens.colors.neutral[200],
          }}
        />
        <Box padding={4} gap={2}>
          <Box
            style={{
              height: 20,
              backgroundColor: designTokens.colors.neutral[200],
              borderRadius: designTokens.radius.sm,
            }}
          />
          <Box
            style={{
              height: 16,
              width: '60%',
              backgroundColor: designTokens.colors.neutral[200],
              borderRadius: designTokens.radius.sm,
            }}
          />
        </Box>
      </Box>
    ))}
  </Box>
), []);

// Modern FlatList usage - much simpler configuration
const ModernTravelList = ({ travels, loading, empty, ...props }) => (
  <FlatList
    data={travels}
    renderItem={renderTravelItem}
    keyExtractor={(item) => `travel-${item.id}`}
    contentContainerStyle={{
      padding: designTokens.spacing[4],
      gap: designTokens.spacing[4],
    }}
    ListEmptyComponent={
      loading ? renderLoadingState() : renderEmptyState(props)
    }
    showsVerticalScrollIndicator={false}
    // Modern virtualization settings
    initialNumToRender={8}
    maxToRenderPerBatch={4}
    windowSize={10}
    removeClippedSubviews={false}
    // Modern refresh control
    refreshing={false}
    onRefresh={() => console.log('Refresh')}
  />
);

export { ModernTravelList, renderTravelItem, renderEmptyState, renderLoadingState };
