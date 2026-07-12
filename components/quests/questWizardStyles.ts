import { StyleSheet } from 'react-native';
import type { useThemedColors } from '@/hooks/useTheme';

import { createShellStyles } from './questWizardStyles/shellStyles';
import { createHeaderStyles } from './questWizardStyles/headerStyles';
import { createStepsNavStyles } from './questWizardStyles/stepsNavStyles';
import { createCardStyles } from './questWizardStyles/cardStyles';
import { createAnswerStyles } from './questWizardStyles/answerStyles';
import { createNavControlStyles } from './questWizardStyles/navControlStyles';
import { createMediaStyles } from './questWizardStyles/mediaStyles';
import { createExcursionsStyles } from './questWizardStyles/excursionsStyles';

export const createQuestWizardStyles = (colors: ReturnType<typeof useThemedColors>, isMobile = false, screenW = 400, fontScale = 1) => StyleSheet.create({
    ...createShellStyles(colors, isMobile, screenW),
    ...createHeaderStyles(colors, isMobile, screenW),
    ...createStepsNavStyles(colors, isMobile, screenW),
    ...createCardStyles(colors, isMobile, screenW, fontScale),
    ...createAnswerStyles(colors, isMobile, screenW, fontScale),
    ...createNavControlStyles(colors, isMobile, screenW),
    ...createMediaStyles(colors, isMobile, screenW),
    ...createExcursionsStyles(colors, isMobile, screenW),
});
