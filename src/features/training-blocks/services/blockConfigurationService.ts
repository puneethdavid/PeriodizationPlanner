import { parseWithSchema } from "@/schema/parseWithSchema";

import {
  benchmarkEligibleExerciseSlugs,
  primaryEligibleExerciseSlugs,
  secondaryEligibleExerciseSlugs,
} from "@/features/training-blocks/domain/exerciseCatalog";
import type {
  BlockConfiguration,
  BlockDurationWeeks,
  LiftGoal,
  TargetLiftGoal,
  ValidatedBlockConfiguration,
} from "@/features/training-blocks/schema/trainingBlockSchemas";
import {
  blockConfigurationSchema,
  lpCheckpointTypeSchema,
  targetLiftGoalsSchema,
  validatedBlockConfigurationSchema,
} from "@/features/training-blocks/schema/trainingBlockSchemas";
import {
  createDefaultBlockSchedulingPreferences,
  formatTrainingWeekday,
  parseSerializedTrainingWeekdays,
  serializeTrainingWeekdays,
} from "@/features/training-blocks/services/blockSchedulingService";

export const blockDurationWeekOptions = [4, 6, 8] as const satisfies readonly BlockDurationWeeks[];
export const liftGoalOptions = [
  "strength",
  "hypertrophy",
  "power",
  "technique",
] as const satisfies readonly LiftGoal[];
export const sessionPrimaryLiftCountOptions = [1, 2, 3] as const;
export const sessionSecondaryLiftCountOptions = [0, 1, 2, 3] as const;
export const targetLiftGoalTestTypeOptions = lpCheckpointTypeSchema.options;

export const liftGoalLabels: Record<LiftGoal, string> = {
  strength: "Strength",
  hypertrophy: "Hypertrophy",
  power: "Power",
  technique: "Technique",
};

export const createDefaultBlockConfiguration = (): BlockConfiguration => ({
  schedulingPreferences: createDefaultBlockSchedulingPreferences(),
  durationWeeks: 4,
  primaryGoal: "strength",
  secondaryGoal: "hypertrophy",
  benchmarkLiftSlugs: ["back-squat", "bench-press", "deadlift"],
  primaryLiftsPerSession: 1,
  secondaryLiftsPerSession: 1,
  primaryLiftPool: [...primaryEligibleExerciseSlugs],
  secondaryLiftPool: [...secondaryEligibleExerciseSlugs],
  targetLiftGoals: [],
});

export const parseBlockConfiguration = (input: BlockConfiguration): BlockConfiguration => {
  return parseWithSchema(blockConfigurationSchema, input, "training-blocks.block-configuration");
};

export const validateBlockConfiguration = (
  input: BlockConfiguration,
): ValidatedBlockConfiguration => {
  return parseWithSchema(
    validatedBlockConfigurationSchema,
    input,
    "training-blocks.validated-block-configuration",
  );
};

export const serializeLiftSlugList = (liftSlugs: readonly string[]): string => liftSlugs.join(",");
export const serializeTargetLiftGoals = (goals: readonly TargetLiftGoal[]): string =>
  JSON.stringify(goals);

export const parseSerializedLiftSlugList = (value: string): readonly string[] => {
  if (value.trim().length === 0) {
    return [];
  }

  return value
    .split(",")
    .map((liftSlug) => liftSlug.trim())
    .filter((liftSlug) => liftSlug.length > 0);
};

export const parseSerializedTargetLiftGoals = (
  value: string | null,
): readonly TargetLiftGoal[] => {
  if (value === null || value.trim().length === 0) {
    return [];
  }

  return parseWithSchema(
    targetLiftGoalsSchema,
    JSON.parse(value) as unknown,
    "training-blocks.target-lift-goals-snapshot",
  );
};

export const summarizeBlockConfiguration = (configuration: BlockConfiguration): string => {
  const weekdaySummary = configuration.schedulingPreferences.selectedTrainingWeekdays
    .map((weekday) => formatTrainingWeekday(weekday))
    .filter((label): label is string => label !== null)
    .join(", ");

  return `${configuration.durationWeeks} weeks • ${liftGoalLabels[configuration.primaryGoal]} primary goal • ${configuration.schedulingPreferences.trainingDaysPerWeek} training days (${weekdaySummary})`;
};

export const serializeBlockConfigurationSnapshot = (configuration: BlockConfiguration): {
  durationWeeks: number;
  primaryGoal: LiftGoal;
  secondaryGoal: LiftGoal;
  benchmarkLiftSlugs: string;
  primaryLiftsPerSession: number;
  secondaryLiftsPerSession: number;
  primaryLiftPool: string;
  secondaryLiftPool: string;
  targetLiftGoals: string;
  trainingDaysPerWeek: number;
  selectedTrainingWeekdays: string;
} => ({
  durationWeeks: configuration.durationWeeks,
  primaryGoal: configuration.primaryGoal,
  secondaryGoal: configuration.secondaryGoal,
  benchmarkLiftSlugs: serializeLiftSlugList(configuration.benchmarkLiftSlugs),
  primaryLiftsPerSession: configuration.primaryLiftsPerSession,
  secondaryLiftsPerSession: configuration.secondaryLiftsPerSession,
  primaryLiftPool: serializeLiftSlugList(configuration.primaryLiftPool),
  secondaryLiftPool: serializeLiftSlugList(configuration.secondaryLiftPool),
  targetLiftGoals: serializeTargetLiftGoals(configuration.targetLiftGoals),
  trainingDaysPerWeek: configuration.schedulingPreferences.trainingDaysPerWeek,
  selectedTrainingWeekdays: serializeTrainingWeekdays(
    configuration.schedulingPreferences.selectedTrainingWeekdays,
  ),
});

export const parseBlockConfigurationSnapshot = (input: {
  durationWeeks: number | null;
  primaryGoal: LiftGoal | null;
  secondaryGoal: LiftGoal | null;
  benchmarkLiftSlugs: string | null;
  primaryLiftsPerSession: number | null;
  secondaryLiftsPerSession: number | null;
  primaryLiftPool: string | null;
  secondaryLiftPool: string | null;
  targetLiftGoals: string | null;
  trainingDaysPerWeek: number | null;
  selectedTrainingWeekdays: string | null;
}): BlockConfiguration | null => {
  if (
    input.durationWeeks === null ||
    input.primaryGoal === null ||
    input.secondaryGoal === null ||
    input.benchmarkLiftSlugs === null ||
    input.primaryLiftsPerSession === null ||
    input.secondaryLiftsPerSession === null ||
    input.primaryLiftPool === null ||
    input.secondaryLiftPool === null ||
    input.trainingDaysPerWeek === null ||
    input.selectedTrainingWeekdays === null
  ) {
    return null;
  }

  return parseWithSchema(
    blockConfigurationSchema,
    {
      schedulingPreferences: {
        trainingDaysPerWeek: input.trainingDaysPerWeek,
        selectedTrainingWeekdays: parseSerializedTrainingWeekdays(input.selectedTrainingWeekdays),
      },
      durationWeeks: input.durationWeeks,
      primaryGoal: input.primaryGoal,
      secondaryGoal: input.secondaryGoal,
      benchmarkLiftSlugs: parseSerializedLiftSlugList(input.benchmarkLiftSlugs),
      primaryLiftsPerSession: input.primaryLiftsPerSession,
      secondaryLiftsPerSession: input.secondaryLiftsPerSession,
      primaryLiftPool: parseSerializedLiftSlugList(input.primaryLiftPool),
      secondaryLiftPool: parseSerializedLiftSlugList(input.secondaryLiftPool),
      targetLiftGoals: parseSerializedTargetLiftGoals(input.targetLiftGoals),
    },
    "training-blocks.block-configuration-snapshot",
  );
};
