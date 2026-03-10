import { useCallback, useMemo, useState } from 'react';

export const useAccessibilityAnnounce = () => {
  const [announcement, setAnnouncement] = useState('');
  const [priority, setPriority] = useState<'polite' | 'assertive'>('polite');

  const announce = useCallback(
    (message: string, isPriority = false) => {
      setPriority(isPriority ? 'assertive' : 'polite');
      setAnnouncement(message);

      const timeout = setTimeout(() => {
        setAnnouncement('');
      }, 1000);

      return () => clearTimeout(timeout);
    },
    []
  );

  return useMemo(() => ({
    announcement,
    priority,
    announce,
  }), [announcement, priority, announce]);
};
