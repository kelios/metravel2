import { Platform } from 'react-native';
import type { KeyboardAvoidingViewProps } from 'react-native';

/**
 * Канонический `behavior` для KeyboardAvoidingView во всех шагах мастера.
 *
 * Android работает в режиме `softwareKeyboardLayoutMode: "resize"` (app.json) —
 * система сама усаживает окно под клавиатуру, а внутренний ScrollView домотает
 * до сфокусированного поля. `behavior='height'` поверх resize сжимает контент
 * повторно (двойная компенсация — поле уезжает/дёргается). Поэтому на Android
 * KAV не делает ничего. iOS окно не резайзит, поэтому оставляем 'padding'.
 * Тот же контракт использует чат (`components/messages/ChatView.tsx`).
 */
export const WIZARD_KEYBOARD_BEHAVIOR: KeyboardAvoidingViewProps['behavior'] =
  Platform.OS === 'ios' ? 'padding' : undefined;
