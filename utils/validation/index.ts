/**
 * ✅ UNIFIED VALIDATION SYSTEM
 * Консолидированная система валидации для всего приложения
 *
 * Экспортирует:
 * - Auth валидацию (регистрация, логин, сброс пароля)
 * - Travel валидацию (создание/редактирование путешествий)
 * - Form валидацию (общие утилиты)
 */

// Re-export auth validation from original file
export * from '../validation';

// Re-export travel form validation (avoid name collisions with wizard validation)
export {
  validateName,
  validateDescription,
  validateCountries,
  validateCategories,
  validateMarkers,
  validateStep as validateTravelFormStep,
  getModerationErrors,
  getModerationIssues,
} from '../formValidation';

export type {
  TravelFormValidation,
  TravelFormLike,
  ModerationIssue,
  ModerationIssueKey,
  ValidationError as TravelFormValidationError,
  ValidationResult as TravelFormValidationResult,
} from '../formValidation';

// Re-export wizard validation (namespaced/aliased)
export {
  validateStep as validateWizardStep,
  validateField,
  getStepProgress,
  isReadyForModeration,
  STEP_VALIDATION_RULES,
} from '../travelWizardValidation';

export type {
  ValidationError as WizardValidationError,
  ValidationResult as WizardValidationResult,
  ValidationWarning as WizardValidationWarning,
  FieldValidationResult,
} from '../travelWizardValidation';

/**
 * Centralized validation helper
 * Объединяет все валидаторы в один интерфейс
 */
export const Validation = {
  // Auth
  isValidEmail: async (email: string) => {
    const { isValidEmail } = await import('../validation');
    return isValidEmail(email);
  },
  isValidPassword: async (password: string) => {
    const { isValidPassword } = await import('../validation');
    return isValidPassword(password);
  },
  meetsPasswordRequirements: (password: string) => {
    const { meetsPasswordRequirements } = require('../validation');
    return meetsPasswordRequirements(password);
  },

  // Travel Form
  validateName: (name: string | undefined | null) => {
    const { validateName } = require('../formValidation');
    return validateName(name);
  },
  validateDescription: (description: string | undefined | null) => {
    const { validateDescription } = require('../formValidation');
    return validateDescription(description);
  },
  validateCountries: (countries: string[] | undefined | null) => {
    const { validateCountries } = require('../formValidation');
    return validateCountries(countries);
  },
  validateCategories: (categories: string[] | undefined | null) => {
    const { validateCategories } = require('../formValidation');
    return validateCategories(categories);
  },

  // Wizard Step Validation
  validateStep: (step: number, formData: unknown) => {
    const { validateStep } = require('../travelWizardValidation');
    return validateStep(step, formData);
  },
  validateField: (fieldName: string, value: unknown, rules: unknown) => {
    const { validateField } = require('../travelWizardValidation');
    return validateField(fieldName, value, rules);
  },
  getStepProgress: (step: number, formData: unknown) => {
    const { getStepProgress } = require('../travelWizardValidation');
    return getStepProgress(step, formData);
  },
  isReadyForModeration: (formData: unknown) => {
    const { isReadyForModeration } = require('../travelWizardValidation');
    return isReadyForModeration(formData);
  },
} as const;

export default Validation;
