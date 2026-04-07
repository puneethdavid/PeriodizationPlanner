import type { BlockConfiguration, TrainingWeekday } from "@/features/training-blocks/schema/trainingBlockSchemas";
import type { BenchmarkInput } from "@/features/training-blocks/schema/trainingBlockSchemas";
import {
  createDefaultBlockConfiguration,
  validateBlockConfiguration,
} from "@/features/training-blocks/services/blockConfigurationService";
import { trainingWeekdayOrder } from "@/features/training-blocks/services/blockSchedulingService";

export type BlockConfigurationDraft = BlockConfiguration;

export type BlockConfigurationDraftErrors = Partial<
  Record<
    | "schedulingPreferences"
    | "durationWeeks"
    | "primaryGoal"
    | "secondaryGoal"
    | "benchmarkLiftSlugs"
    | "primaryLiftsPerSession"
    | "secondaryLiftsPerSession"
    | "primaryLiftPool"
    | "secondaryLiftPool",
    string
  >
>;

export const createEmptyBlockConfigurationDraft = (): BlockConfigurationDraft =>
  createDefaultBlockConfiguration();

export const createBlockConfigurationDraftFromSaved = (
  savedConfiguration: BlockConfiguration,
): BlockConfigurationDraft => ({
  ...savedConfiguration,
  schedulingPreferences: {
    ...savedConfiguration.schedulingPreferences,
    selectedTrainingWeekdays: [...savedConfiguration.schedulingPreferences.selectedTrainingWeekdays],
  },
  benchmarkLiftSlugs: [...savedConfiguration.benchmarkLiftSlugs],
  primaryLiftPool: [...savedConfiguration.primaryLiftPool],
  secondaryLiftPool: [...savedConfiguration.secondaryLiftPool],
});

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

export const toggleLiftSlugSelection = (
  currentLiftSlugs: readonly BenchmarkInput["liftSlug"][],
  liftSlug: BenchmarkInput["liftSlug"],
): readonly BenchmarkInput["liftSlug"][] => {
  if (currentLiftSlugs.includes(liftSlug)) {
    return currentLiftSlugs.filter((currentLiftSlug) => currentLiftSlug !== liftSlug);
  }

  return [...currentLiftSlugs, liftSlug];
};

export const validateBlockConfigurationDraft = (
  draft: BlockConfigurationDraft,
): {
  data: BlockConfiguration | null;
  errors: BlockConfigurationDraftErrors;
} => {
  try {
    const validated = validateBlockConfiguration(draft);

    return {
      data: validated,
      errors: {},
    };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Save a valid block configuration before generating.";

    return {
      data: null,
      errors: {
        schedulingPreferences: message,
      },
    };
  }
};
