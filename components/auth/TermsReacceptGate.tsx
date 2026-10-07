import { readRetryOnce } from '@/utils/queryRetryPolicy';
import React, { lazy, Suspense } from 'react';
import { usePathname } from 'expo-router';
import { useQuery } from '@tanstack/react-query';

import { fetchTermsAcceptedCurrent } from '@/api/consent';
import { queryKeys } from '@/api/queryKeys';
import { useAuth } from '@/context/AuthContext';

const TermsReacceptSheet = lazy(() => import('@/components/auth/TermsReacceptSheet'));

// Юр-страницы, на которые ведут ссылки листа: пока человек их читает, лист не
// перекрывает текст, а после возврата появляется снова.
const LEGAL_READING_PATHS = new Set(['/terms', '/community-rules']);

/**
 * #2132: вошедший аккаунт без согласия с текущей версией условий
 * (`/user/me/` → `terms_accepted_current: false`) не пользуется приложением,
 * пока не примет условия заново. Гостю и ответу без поля (старый бэкенд)
 * гейт ничего не показывает; сам лист грузится отдельным чанком только тогда,
 * когда он нужен.
 */
export default function TermsReacceptGate() {
  const { isAuthenticated, userId } = useAuth();
  const pathname = usePathname();
  const { data: acceptedCurrent } = useQuery({
    queryKey: queryKeys.termsAcceptedCurrent(userId),
    queryFn: fetchTermsAcceptedCurrent,
    enabled: isAuthenticated && Boolean(userId),
    staleTime: 10 * 60 * 1000,
    retry: readRetryOnce,
  });

  if (!isAuthenticated || acceptedCurrent !== false) return null;
  if (LEGAL_READING_PATHS.has(pathname)) return null;

  return (
    <Suspense fallback={null}>
      <TermsReacceptSheet userId={userId} />
    </Suspense>
  );
}
