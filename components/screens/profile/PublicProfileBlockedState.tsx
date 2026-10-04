// #2134: профиль пользователя, которого вы заблокировали. Вместо вкладок и
// путешествий — объяснение и «Разблокировать» с подтверждением; мутация
// оптимистично снимает `is_blocked_by_me`, и экран сразу возвращается к обычному виду.

import EmptyState from '@/components/ui/EmptyState';
import { useUnblockUser } from '@/hooks/useUserSafety';
import { confirmUnblockUser } from '@/utils/confirmUserBlock';
import { translate as i18nT } from '@/i18n';

interface Props {
  userId: string;
  fullName?: string;
}

export function PublicProfileBlockedState({ userId, fullName }: Props) {
  const unblockMutation = useUnblockUser();

  const handleUnblock = async () => {
    if (!(await confirmUnblockUser(fullName))) return;
    unblockMutation.mutate(userId);
  };

  return (
    <EmptyState
      density="compact"
      variant="empty"
      icon="slash"
      title={i18nT('profile:components.screens.profile.PublicProfileBlockedState.title')}
      description={i18nT('profile:components.screens.profile.PublicProfileBlockedState.description')}
      action={{
        label: i18nT('profile:components.screens.profile.PublicProfileBlockedState.unblock'),
        icon: 'user-check',
        onPress: () => void handleUnblock(),
        loading: unblockMutation.isPending,
        disabled: unblockMutation.isPending,
        testID: 'public-profile-unblock',
      }}
      testID="public-profile-blocked"
    />
  );
}
