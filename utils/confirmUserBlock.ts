// #2134: подтверждения блокировки и разблокировки — одни тексты для меню профиля,
// списка «Заблокированные» и баннера на профиле заблокированного. Диалог —
// общий `confirmAction` (web: дизайн-системный ConfirmDialog, native: Alert с
// destructive-кнопкой).

import { confirmAction } from '@/utils/confirmAction'
import { translate as i18nT } from '@/i18n'

const cleanName = (name?: string | null): string => (typeof name === 'string' ? name.trim() : '')

export function confirmBlockUser(name?: string | null): Promise<boolean> {
  const displayName = cleanName(name)
  return confirmAction({
    title: displayName
      ? i18nT('profile:components.profile.UserSafetyMenu.blockConfirmTitleNamed', { name: displayName })
      : i18nT('profile:components.profile.UserSafetyMenu.blockConfirmTitle'),
    message: i18nT('profile:components.profile.UserSafetyMenu.blockConfirmMessage'),
    confirmText: i18nT('profile:components.profile.UserSafetyMenu.blockConfirmAction'),
  })
}

export function confirmUnblockUser(name?: string | null): Promise<boolean> {
  const displayName = cleanName(name)
  return confirmAction({
    title: displayName
      ? i18nT('profile:components.profile.UserSafetyMenu.unblockConfirmTitleNamed', { name: displayName })
      : i18nT('profile:components.profile.UserSafetyMenu.unblockConfirmTitle'),
    message: i18nT('profile:components.profile.UserSafetyMenu.unblockConfirmMessage'),
    confirmText: i18nT('profile:components.profile.UserSafetyMenu.unblockConfirmAction'),
  })
}
