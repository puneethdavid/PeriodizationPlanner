import type {
  Benchmark,
  BenchmarkInput,
  BlockConfiguration,
  TargetLiftGoal,
  TrainingWeekday,
} from "@/features/training-blocks/schema/trainingBlockSchemas";
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
    | "secondaryLiftPool"
    | "targetLiftGoals",
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
  targetLiftGoals: savedConfiguration.targetLiftGoals.map((goal) => ({ ...goal })),
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

export const toggleTargetLiftGoalSelection = (
  currentGoals: readonly TargetLiftGoal[],
  liftSlug: BenchmarkInput["liftSlug"],
): readonly TargetLiftGoal[] => {
  if (currentGoals.some((goal) => goal.liftSlug === liftSlug)) {
    return currentGoals.filter((goal) => goal.liftSlug !== liftSlug);
  }

  return [
    ...currentGoals,
    {
      liftSlug,
      targetWeight: 0,
      targetTestType: "three-rep-max",
    },
  ];
};

export const validateBlockConfigurationDraft = (
  draft: BlockConfigurationDraft,
  benchmarks: readonly Benchmark[] = [],
): {
  data: BlockConfiguration | null;
  errors: BlockConfigurationDraftErrors;
} => {
  try {
    const validated = validateBlockConfiguration(draft);
    const benchmarkByLiftSlug = new Map(
      benchmarks.map((benchmark) => [benchmark.liftSlug, benchmark] as const),
    );

    for (const goal of validated.targetLiftGoals) {
      const benchmark = benchmarkByLiftSlug.get(goal.liftSlug);

      if (benchmark === undefined) {
        throw new Error(
          `[training-blocks.target-goals] Save a benchmark for ${goal.liftSlug} before setting a target goal.`,
        );
      }

      if (goal.targetWeight <= benchmark.value) {
        throw new Error(
          `[training-blocks.target-goals] Target goals must be higher than the saved benchmark for ${goal.liftSlug}.`,
        );
      }
    }

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
        targetLiftGoals: message,
      },
    };
  }
};
