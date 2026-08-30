export type QuestPointRole = 'start' | 'required' | 'optional' | 'final';

/**
 * One count model for every quest surface.
 *
 * `null` means that the API did not classify every numbered route point. It is
 * deliberately different from zero: the client must not turn an absent flag
 * into a claim that the route has no optional or final points.
 */
type QuestCountModelBase = {
  /** Numbered route points; the separate intro/start screen is not included. */
  total: number;
  start: number;
  /** Denominator used by the existing completion/progress mechanics. */
  progressTotal: number;
};

export type QuestCountModel = QuestCountModelBase & (
  | {
    required: number;
    optional: number;
    final: number;
    source: 'explicit';
  }
  | {
    required: null;
    optional: null;
    final: null;
    source: 'fallback';
  }
);

type QuestCountStep = { pointRole?: QuestPointRole };

const NUMBERED_POINT_ROLES = new Set<QuestPointRole>(['required', 'optional', 'final']);

const hasValidNumberedRole = (step: QuestCountStep): boolean =>
  step.pointRole != null && NUMBERED_POINT_ROLES.has(step.pointRole);

/**
 * Build counts without parsing authored titles, ids or answer patterns.
 *
 * Until every numbered point has an explicit valid role, visible role counts
 * stay unknown. The fallback uses all structurally numbered steps and never
 * infers completion ownership from authored copy or answer behavior.
 */
export function buildQuestCountModel(
  steps: readonly QuestCountStep[],
  intro?: QuestCountStep,
): QuestCountModel {
  const hasExplicitRoles = steps.length > 0 && steps.every(hasValidNumberedRole);

  if (!hasExplicitRoles) {
    return {
      total: steps.length,
      required: null,
      optional: null,
      start: intro ? 1 : 0,
      final: null,
      progressTotal: steps.length,
      source: 'fallback',
    };
  }

  const required = steps.filter((step) => step.pointRole === 'required').length;
  return {
    total: steps.length,
    required,
    optional: steps.filter((step) => step.pointRole === 'optional').length,
    start: intro ? 1 : 0,
    final: steps.filter((step) => step.pointRole === 'final').length,
    progressTotal: required,
    source: 'explicit',
  };
}

/** Points which own progress/completion when the explicit role contract exists. */
export function getQuestProgressSteps<T extends QuestCountStep>(
  steps: readonly T[],
  countModel: QuestCountModel,
): T[] {
  if (countModel.source === 'explicit') {
    return steps.filter((step) => step.pointRole === 'required');
  }
  return [...steps];
}

/** Required work plus the final route point that must be reached before the finale opens. */
export function getQuestRouteGateSteps<T extends QuestCountStep>(
  steps: readonly T[],
  countModel: QuestCountModel,
): T[] {
  if (countModel.source === 'explicit') {
    return steps.filter((step) => step.pointRole === 'required' || step.pointRole === 'final');
  }
  return [...steps];
}
