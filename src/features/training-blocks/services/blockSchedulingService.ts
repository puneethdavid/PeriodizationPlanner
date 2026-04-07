import { parseWithSchema } from "@/schema/parseWithSchema";

import {
  blockSchedulingPreferencesSchema,
  validatedBlockSchedulingPreferencesSchema,
  type BlockSchedulingPreferences,
  type TrainingWeekday,
  type ValidatedBlockSchedulingPreferences,
} from "@/features/training-blocks/schema/trainingBlockSchemas";

export const trainingWeekdayOrder = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
] as const satisfies readonly TrainingWeekday[];

export const trainingWeekdayLabels: Record<TrainingWeekday, string> = {
  monday: "Monday",
  tuesday: "Tuesday",
  wednesday: "Wednesday",
  thursday: "Thursday",
  friday: "Friday",
  saturday: "Saturday",
  sunday: "Sunday",
};

export const createDefaultBlockSchedulingPreferences = (): BlockSchedulingPreferences => ({
  trainingDaysPerWeek: 3,
  selectedTrainingWeekdays: ["monday", "wednesday", "friday"],
});

export const serializeTrainingWeekdays = (weekdays: readonly TrainingWeekday[]): string => {
  return weekdays.join(",");
};

export const parseSerializedTrainingWeekdays = (value: string): readonly TrainingWeekday[] => {
  if (value.trim().length === 0) {
    return [];
  }

  return value
    .split(",")
    .map((weekday) => weekday.trim())
    .filter((weekday): weekday is TrainingWeekday => trainingWeekdayOrder.includes(weekday as TrainingWeekday));
};

export const parseBlockSchedulingPreferences = (
  input: BlockSchedulingPreferences,
): BlockSchedulingPreferences => {
  return parseWithSchema(
    blockSchedulingPreferencesSchema,
    input,
    "training-blocks.block-scheduling-preferences",
  );
};

export const validateBlockSchedulingPreferences = (
  input: BlockSchedulingPreferences,
): ValidatedBlockSchedulingPreferences => {
  return parseWithSchema(
    validatedBlockSchedulingPreferencesSchema,
    input,
    "training-blocks.validated-block-scheduling-preferences",
  );
};

export const formatTrainingWeekday = (weekday: TrainingWeekday | null | undefined): string | null => {
  if (weekday === null || weekday === undefined) {
    return null;
  }

  return trainingWeekdayLabels[weekday];
};
