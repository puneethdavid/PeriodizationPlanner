import type {
  BlockSchedulingPreferences,
  TrainingWeekday,
} from "@/features/training-blocks/schema/trainingBlockSchemas";
import {
  createDefaultBlockSchedulingPreferences,
  trainingWeekdayOrder,
  validateBlockSchedulingPreferences,
} from "@/features/training-blocks/services/blockSchedulingService";

export type BlockSchedulingDraft = {
  trainingDaysPerWeek: number;
  selectedTrainingWeekdays: readonly TrainingWeekday[];
};

export type BlockSchedulingDraftErrors = {
  trainingDaysPerWeek?: string;
  selectedTrainingWeekdays?: string;
};

export const createEmptyBlockSchedulingDraft = (): BlockSchedulingDraft => {
  return createDefaultBlockSchedulingPreferences();
};

export const createBlockSchedulingDraftFromSaved = (
  savedPreferences: BlockSchedulingPreferences,
): BlockSchedulingDraft => {
  return {
    trainingDaysPerWeek: savedPreferences.trainingDaysPerWeek,
    selectedTrainingWeekdays: [...savedPreferences.selectedTrainingWeekdays],
  };
};

export const toggleTrainingWeekday = (
  currentWeekdays: readonly TrainingWeekday[],
  weekday: TrainingWeekday,
): readonly TrainingWeekday[] => {
  if (currentWeekdays.includes(weekday)) {
    return currentWeekdays.filter((currentWeekday) => currentWeekday !== weekday);
  }

  return [...currentWeekdays, weekday].sort(
    (left, right) => trainingWeekdayOrder.indexOf(left) - trainingWeekdayOrder.indexOf(right),
  );
};

export const validateBlockSchedulingDraft = (
  draft: BlockSchedulingDraft,
): {
  data: BlockSchedulingPreferences | null;
  errors: BlockSchedulingDraftErrors;
} => {
  try {
    const validated = validateBlockSchedulingPreferences({
      trainingDaysPerWeek: draft.trainingDaysPerWeek,
      selectedTrainingWeekdays: [...draft.selectedTrainingWeekdays],
    });

    return {
      data: validated,
      errors: {},
    };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Save a valid weekly frequency and weekday set.";

    return {
      data: null,
      errors: {
        selectedTrainingWeekdays: message,
      },
    };
  }
};
