import { Platform } from 'react-native';

export const stopWebPopupEvent = (event?: any) => {
  if (Platform.OS !== 'web') return;
  try {
    event?.stopPropagation?.();
    event?.nativeEvent?.stopPropagation?.();
    event?.nativeEvent?.stopImmediatePropagation?.();
  } catch {
    // noop
  }
};

export const POPUP_DOM_EVENTS = [
  'dblclick',
  'contextmenu',
  'mousedown',
  'mouseup',
  'pointerdown',
  'pointerup',
  'touchstart',
  'touchmove',
  'touchend',
  'wheel',
] as const;

export const isCardActionEvent = (event: Event): boolean => {
  if (Platform.OS !== 'web') return false;
  const target = event.target as Element | null;
  return Boolean(target?.closest?.('[data-card-action="true"]'));
};

export const getPopupEventNodes = (node: any): EventTarget[] => {
  if (Platform.OS !== 'web' || !node?.addEventListener) return [];
  return [node];
};

export const isInternalArticleHref = (pathname: string) => (
  pathname.startsWith('/travel/') ||
  pathname.startsWith('/travels/') ||
  pathname.startsWith('/article/') ||
  pathname.startsWith('/articles/')
);
