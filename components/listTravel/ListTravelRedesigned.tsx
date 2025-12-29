// components/listTravel/ListTravelRedesigned.tsx
// ✅ РЕДИЗАЙН: Новая версия ListTravel с управляемыми блоками

import React, { useState } from 'react';
import { View, StyleSheet } from 'react-native';
import MainHubLayout from '@/components/MainHubLayout';
import CollapsibleBlock from '@/components/CollapsibleBlock';
import WelcomeBanner from '@/components/WelcomeBanner';
import RecentViews from '@/components/RecentViews';
import FiltersPanelCollapsible from '@/components/FiltersPanelCollapsible';
import { useBlockVisibility } from '@/hooks/useBlockVisibility';
import { useResponsive } from '@/hooks/useResponsive';

// Это пример интеграции - полная версия будет в основном файле
// Показываю структуру новой страницы

interface ListTravelRedesignedProps {
  // Все пропсы из оригинального ListTravel
}

export default function ListTravelRedesigned(_: ListTravelRedesignedProps) {
  const { isPhone, isLargePhone } = useResponsive();
  const isMobile = isPhone || isLargePhone;
  const [mode] = useState<'compact' | 'expanded' | 'smart'>('smart');
  
  const {
    getBlockState,
    toggleExpanded,
    toggleHidden,
    isLoaded,
  } = useBlockVisibility();

  if (!isLoaded) {
    return null; // Можно показать skeleton
  }

  return (
    <MainHubLayout>
      {/* Блок приветствия */}
      <CollapsibleBlock
        id="welcomeBanner"
        title="Добро пожаловать"
        description="Откройте мир путешествий"
        icon="sun"
        defaultExpanded={getBlockState('welcomeBanner').expanded}
        defaultHidden={getBlockState('welcomeBanner').hidden}
        onToggle={() => toggleExpanded('welcomeBanner')}
        onHide={() => toggleHidden('welcomeBanner')}
        compactMode={mode === 'compact'}
      >
        <WelcomeBanner compact={mode === 'compact'} />
      </CollapsibleBlock>

      {/* Блок поиска */}
      <CollapsibleBlock
        id="search"
        title="Поиск путешествий"
        description="Найдите интересующие вас маршруты"
        icon="search"
        defaultExpanded={getBlockState('search').expanded}
        defaultHidden={getBlockState('search').hidden}
        onToggle={() => toggleExpanded('search')}
        onHide={() => toggleHidden('search')}
        compactMode={mode === 'compact'}
      >
        <View style={styles.searchWrapper}>
          {/* SearchAndFilterBar будет здесь */}
        </View>
      </CollapsibleBlock>

      {/* Блок фильтров */}
      {!isMobile && (
        <CollapsibleBlock
          id="filters"
          title="Фильтры"
          description="Настройте параметры поиска"
          icon="filter"
          defaultExpanded={getBlockState('filters').expanded}
          defaultHidden={getBlockState('filters').hidden}
          onToggle={() => toggleExpanded('filters')}
          onHide={() => toggleHidden('filters')}
          compactMode={mode === 'compact'}
        >
          <FiltersPanelCollapsible
            filters={null} // Будет из пропсов
            filterValue={{}}
            onSelectedItemsChange={() => {}}
            handleApplyFilters={() => {}}
            resetFilters={() => {}}
            isExpanded={getBlockState('filters').expanded}
            isHidden={getBlockState('filters').hidden}
            onToggleExpanded={() => toggleExpanded('filters')}
            onToggleHidden={() => toggleHidden('filters')}
          />
        </CollapsibleBlock>
      )}

      {/* Блок недавних просмотров */}
      <CollapsibleBlock
        id="recentViews"
        title="Недавние просмотры"
        description="Путешествия, которые вы недавно смотрели"
        icon="clock"
        defaultExpanded={getBlockState('recentViews').expanded}
        defaultHidden={getBlockState('recentViews').hidden}
        onToggle={() => toggleExpanded('recentViews')}
        onHide={() => toggleHidden('recentViews')}
        compactMode={mode === 'compact'}
      >
        <RecentViews compact={mode === 'compact'} />
      </CollapsibleBlock>

      {/* Здесь будут остальные блоки:
          - Tabs (Рекомендации / Подборка недели)
          - Recommendations
          - Travel Cards
          - Popular Categories
      */}
    </MainHubLayout>
  );
}

const styles = StyleSheet.create({
  searchWrapper: {
    padding: 0,
  },
});
