/**
 * Accessibility Components Index
 * All a11y components exported here
 */

export { SkipLinks, default as SkipLinksComponent } from './SkipLinks';
export { ThemeToggle, default as ThemeToggleComponent } from './ThemeToggle';
export {
  FocusableButton,
  FocusStyles,
  useFocusManagement,
  useFocusTrap,
} from './FocusManagement';
export {
  LiveRegion,
  StatusMessage,
  ErrorMessage,
  LoadingMessage,
  SuccessMessage,
  useLiveRegion,
  useFormErrorAnnouncer,
} from './LiveRegion';

export type { Theme, ThemeContextType } from '@/hooks/useTheme';

