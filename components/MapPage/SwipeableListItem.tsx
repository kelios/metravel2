import React from 'react';

/**
 * Web-вариант: жесты свайпа не поддерживаются, список показывает только содержимое.
 * Native-реализация (ReanimatedSwipeable) — в `SwipeableListItem.native.tsx`; раздельные
 * файлы не тянут react-native-gesture-handler и reanimated в web-бандл (PERF-014).
 */
interface SwipeableListItemProps {
  children: React.ReactNode;
  onFavorite?: () => void;
  onBuildRoute?: () => void;
  showFavorite?: boolean;
  showRoute?: boolean;
  isFavorite?: boolean;
}

export const SwipeableListItem: React.FC<SwipeableListItemProps> = ({ children }) => <>{children}</>;
