import type React from 'react';

import type { TravelFormData } from '@/types/types';
import type { ModerationIssue } from '@/utils/formValidation';

export interface TravelWizardStepPublishProps {
    currentStep: number;
    totalSteps: number;
    formData: TravelFormData;
    countries?: Array<{
        country_id: string;
        title_ru: string;
        title_en?: string;
        title?: string;
        name?: string;
    }>;
    setFormData: React.Dispatch<React.SetStateAction<TravelFormData>> | ((data: TravelFormData) => void);
    isSuperAdmin: boolean;
    onManualSave: (
        data?: TravelFormData,
        options?: { intent?: 'save' | 'publish' },
    ) => Promise<TravelFormData | void>;
    onGoBack: () => void;
    onFinish: () => void;
    onNavigateToIssue?: (issue: ModerationIssue) => void;
    onStepSelect?: (step: number) => void;
    stepMeta?: {
        title?: string;
        subtitle?: string;
        tipTitle?: string;
        tipBody?: string;
        nextLabel?: string;
    };
    progress?: number;
    autosaveBadge?: string;
    onPreview?: () => void;
    onOpenPublic?: () => void;
}
