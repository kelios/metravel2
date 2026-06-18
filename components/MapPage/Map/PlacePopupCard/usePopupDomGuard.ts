import { useCallback, useRef } from 'react';
import { Platform } from 'react-native';

import {
  getPopupEventNodes,
  isCardActionEvent,
  POPUP_DOM_EVENTS,
} from './domEvents';

// Callback ref: навешивает/снимает guard'ы всплытия при КАЖДОЙ смене host-узла.
// useEffect([]) этого не делал — при свопе layout-ветки (overlay ↔ cardBody по ширине)
// или позднем монтировании узла listeners оставались на устаревшем/отсутствующем узле.
export function usePopupDomGuard() {
  const cardRootRef = useRef<any>(null);
  const popupGuardCleanupRef = useRef<(() => void) | null>(null);

  const setCardRootNode = useCallback((node: any) => {
    cardRootRef.current = node;
    if (popupGuardCleanupRef.current) {
      popupGuardCleanupRef.current();
      popupGuardCleanupRef.current = null;
    }
    if (Platform.OS !== 'web') return;
    const nodes = getPopupEventNodes(node);
    if (!nodes.length) return;

    const stopEvent = (event: Event) => {
      event.stopPropagation();
      if (isCardActionEvent(event)) return;
      (event as any).stopImmediatePropagation?.();
    };

    nodes.forEach((n) => {
      POPUP_DOM_EVENTS.forEach((eventName) => {
        (n as any).addEventListener(eventName, stopEvent);
      });
    });

    popupGuardCleanupRef.current = () => {
      nodes.forEach((n) => {
        POPUP_DOM_EVENTS.forEach((eventName) => {
          (n as any).removeEventListener(eventName, stopEvent);
        });
      });
    };
  }, []);

  return setCardRootNode;
}
