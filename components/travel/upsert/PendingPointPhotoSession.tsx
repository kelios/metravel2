import { createContext, useContext, useEffect, useState, type PropsWithChildren } from 'react';
import { createPendingImageSession } from '@/utils/pendingImageFiles';

const PendingPointPhotoContext = createContext<ReturnType<typeof createPendingImageSession> | null>(null);

export function PendingPointPhotoSession({ children }: PropsWithChildren) {
  const [session] = useState(createPendingImageSession);
  useEffect(() => session.dispose, [session]);
  return <PendingPointPhotoContext.Provider value={session}>{children}</PendingPointPhotoContext.Provider>;
}

export function usePendingPointPhotoSession() {
  return useContext(PendingPointPhotoContext);
}
