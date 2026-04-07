import { z } from "zod";

import {
  nonEmptyStringSchema,
  optionalNullableStringSchema,
  trimmedStringSchema,
} from "@/schema/primitives";
import {
  benchmarkEligibleExerciseSlugs,
  primaryEligibleExerciseSlugs,
  secondaryEligibleExerciseSlugs,
  trackedLiftSlugs,
} from "@/features/training-blocks/domain/exerciseCatalog";

const isoDateSchema = z.iso.date();
const isoDateTimeSchema = z.iso.datetime();
const positiveIntegerSchema = z.number().int().positive();
const nonNegativeNumberSchema = z.number().nonnegative();
const weekdayCountSchema = z.number().int().min(1).max(7);
const secondaryLiftCountSchema = z.number().int().min(0).max(4);

export const liftSlugSchema = z.enum(trackedLiftSlugs);
export const benchmarkEligibleLiftSlugSchema = z.enum(benchmarkEligibleExerciseSlugs as [typeof benchmarkEligibleExerciseSlugs[number], ...typeof benchmarkEligibleExerciseSlugs[number][]]);
export const primaryEligibleLiftSlugSchema = z.enum(primaryEligibleExerciseSlugs as [typeof primaryEligibleExerciseSlugs[number], ...typeof primaryEligibleExerciseSlugs[number][]]);
export const secondaryEligibleLiftSlugSchema = z.enum(secondaryEligibleExerciseSlugs as [typeof secondaryEligibleExerciseSlugs[number], ...typeof secondaryEligibleExerciseSlugs[number][]]);

export const benchmarkTypeSchema = z.enum([
  "one-rep-max",
  "three-rep-max",
  "five-rep-max",
  "working-weight",
]);

export const loadUnitSchema = z.enum(["kg", "lb"]);
export const blockDurationWeeksSchema = z.union([z.literal(4), z.literal(6), z.literal(8)]);
export const liftGoalSchema = z.enum(["strength", "hypertrophy", "power", "technique"]);
export const lpProgramLevelSchema = z.enum(["beginner", "intermediate", "advanced"]);
export const lpProgramPhaseSchema = z.enum(["volume", "strength", "taper", "final-test"]);
export const lpCheckpointTypeSchema = z.enum(["five-rep-max", "three-rep-max", "two-rep-max"]);
export const progressionTierSchema = z.enum(["minimum", "medium", "high"]);
export const goalProgressStatusSchema = z.enum(["on-track", "behind", "achieved"]);
export const trainingWeekdaySchema = z.enum([
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
]);

export const trainingBlockStatusSchema = z.enum(["draft", "active", "completed", "archived"]);
export const sessionTypeSchema = z.enum([
  "primary",
  "secondary",
  "deload",
  "benchmark",
  "final-test",
]);
export const plannedSessionStatusSchema = z.enum(["planned", "completed", "skipped"]);
export const prescriptionKindSchema = z.enum(["fixed-sets", "top-set-backoff", "amrap"]);
export const workoutCompletionStatusSchema = z.enum(["completed", "partial", "missed"]);
export const adaptationEventTypeSchema = z.enum([
  "generation",
  "progression-adjustment",
  "deload-adjustment",
  "checkpoint-recalibration",
  "phase-transition",
  "goal-progress",
  "goal-extension",
  "planned-taper",
]);
export const explanationOwnerTypeSchema = z.enum([
  "training-block",
  "block-revision",
  "adaptation-event",
  "workout-result",
]);

export const benchmarkInputSchema = z.object({
  liftSlug: liftSlugSchema,
  benchmarkType: benchmarkTypeSchema,
  value: z.number().positive(),
  unit: loadUnitSchema.default("kg"),
  capturedAt: isoDateTimeSchema.optional(),
  notes: optionalNullableStringSchema,
});

export const benchmarkSchema = benchmarkInputSchema.extend({
  id: nonEmptyStringSchema,
  capturedAt: isoDateTimeSchema,
  notes: optionalNullableStringSchema,
  createdAt: isoDateTimeSchema,
  updatedAt: isoDateTimeSchema,
});

export const selectedTrainingWeekdaysSchema = z
  .array(trainingWeekdaySchema)
  .min(1)
  .max(7)
  .refine((weekdays) => new Set(weekdays).size === weekdays.length, {
    message: "Selected training weekdays must not contain duplicates.",
  });

export const blockSchedulingPreferencesSchema = z.object({
  trainingDaysPerWeek: weekdayCountSchema,
  selectedTrainingWeekdays: selectedTrainingWeekdaysSchema,
});

export const validatedBlockSchedulingPreferencesSchema = blockSchedulingPreferencesSchema.superRefine(
  (value, context) => {
    if (value.selectedTrainingWeekdays.length !== value.trainingDaysPerWeek) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["selectedTrainingWeekdays"],
        message: "Select the same number of weekdays as the weekly training frequency.",
      });
    }
  },
);

export const uniqueLiftSlugListSchema = z
  .array(liftSlugSchema)
  .min(1)
  .max(12)
  .refine((liftSlugs) => new Set(liftSlugs).size === liftSlugs.length, {
    message: "Lift selections must not contain duplicates.",
  });

export const uniqueBenchmarkLiftSlugListSchema = z
  .array(benchmarkEligibleLiftSlugSchema)
  .min(1)
  .max(8)
  .refine((liftSlugs) => new Set(liftSlugs).size === liftSlugs.length, {
    message: "Benchmark selections must not contain duplicates.",
  });

export const targetLiftGoalSchema = z.object({
  liftSlug: benchmarkEligibleLiftSlugSchema,
  targetWeight: z.number().positive(),
  targetTestType: lpCheckpointTypeSchema,
});

export const targetLiftGoalsSchema = z
  .array(targetLiftGoalSchema)
  .max(4)
  .refine((goals) => new Set(goals.map((goal) => goal.liftSlug)).size === goals.length, {
    message: "Target lift goals must not contain duplicate lifts.",
  });

export const blockConfigurationSchema = z.object({
  schedulingPreferences: blockSchedulingPreferencesSchema,
  durationWeeks: blockDurationWeeksSchema,
  primaryGoal: liftGoalSchema,
  secondaryGoal: liftGoalSchema,
  benchmarkLiftSlugs: uniqueBenchmarkLiftSlugListSchema,
  primaryLiftsPerSession: positiveIntegerSchema.max(4),
  secondaryLiftsPerSession: secondaryLiftCountSchema,
  primaryLiftPool: z.array(primaryEligibleLiftSlugSchema).min(1).max(12),
  secondaryLiftPool: z.array(secondaryEligibleLiftSlugSchema).min(1).max(12),
  targetLiftGoals: targetLiftGoalsSchema.default([]),
});

export const validatedBlockConfigurationSchema = blockConfigurationSchema.superRefine(
  (value, context) => {
    if (
      value.schedulingPreferences.selectedTrainingWeekdays.length !==
      value.schedulingPreferences.trainingDaysPerWeek
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["schedulingPreferences", "selectedTrainingWeekdays"],
        message: "Select the same number of weekdays as the weekly training frequency.",
      });
    }

    if (value.primaryLiftsPerSession > value.primaryLiftPool.length) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["primaryLiftsPerSession"],
        message: "Primary lifts per session cannot exceed the selected primary lift pool.",
      });
    }

    if (value.secondaryLiftsPerSession > value.secondaryLiftPool.length) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["secondaryLiftsPerSession"],
        message: "Secondary lifts per session cannot exceed the selected secondary lift pool.",
      });
    }

    const uniqueLiftCount = new Set([...value.primaryLiftPool, ...value.secondaryLiftPool]).size;

    if (value.primaryLiftsPerSession + value.secondaryLiftsPerSession > uniqueLiftCount) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["secondaryLiftPool"],
        message:
          "Combined primary and secondary session counts need enough unique lifts across both pools.",
      });
    }

    const primaryLiftSet = new Set(value.primaryLiftPool);
    const benchmarkLiftSet = new Set(value.benchmarkLiftSlugs);

    value.benchmarkLiftSlugs.forEach((liftSlug, index) => {
      if (!primaryLiftSet.has(liftSlug)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["benchmarkLiftSlugs", index],
          message: "Benchmark lifts must come from the selected primary lift pool.",
        });
      }
    });

    value.targetLiftGoals.forEach((goal, index) => {
      if (!primaryLiftSet.has(goal.liftSlug)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["targetLiftGoals", index, "liftSlug"],
          message: "Target goals must come from the selected primary lift pool.",
        });
      }
      if (!benchmarkLiftSet.has(goal.liftSlug)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["targetLiftGoals", index, "liftSlug"],
          message: "Target goals must use one of the selected benchmark lifts.",
        });
      }
    });
  },
);

export const benchmarkSnapshotItemSchema = z.object({
  id: nonEmptyStringSchema,
  snapshotId: nonEmptyStringSchema,
  benchmarkId: nonEmptyStringSchema.nullable(),
  liftSlug: liftSlugSchema,
  benchmarkType: benchmarkTypeSchema,
  value: z.number().positive(),
  unit: loadUnitSchema,
  capturedAt: isoDateTimeSchema,
  notes: optionalNullableStringSchema,
});

export const benchmarkSnapshotSchema = z.object({
  id: nonEmptyStringSchema,
  createdAt: isoDateTimeSchema,
  items: z.array(benchmarkSnapshotItemSchema).min(1),
});

export const trainingBlockSchema = z.object({
  id: nonEmptyStringSchema,
  name: nonEmptyStringSchema,
  status: trainingBlockStatusSchema,
  goalSlug: trimmedStringSchema.min(1).default("general-strength"),
  startDate: isoDateSchema,
  endDate: isoDateSchema,
  benchmarkSnapshotId: nonEmptyStringSchema,
  generationVersion: nonEmptyStringSchema,
  createdAt: isoDateTimeSchema,
  updatedAt: isoDateTimeSchema,
  notes: optionalNullableStringSchema,
  schedulingPreferences: blockSchedulingPreferencesSchema.nullable().default(null),
  blockConfiguration: blockConfigurationSchema.nullable().default(null),
});

export const blockRevisionSchema = z.object({
  id: nonEmptyStringSchema,
  blockId: nonEmptyStringSchema,
  revisionNumber: positiveIntegerSchema,
  reason: nonEmptyStringSchema,
  summary: nonEmptyStringSchema,
  createdAt: isoDateTimeSchema,
});

export const plannedSessionLpMetadataSchema = z.object({
  phase: lpProgramPhaseSchema.nullable().default(null),
  phaseWeekIndex: positiveIntegerSchema.nullable().default(null),
  checkpointType: lpCheckpointTypeSchema.nullable().default(null),
  mesocycleIndex: positiveIntegerSchema.nullable().default(null),
  isTaperSession: z.boolean().default(false),
  goalLiftSlugs: z.array(liftSlugSchema).default([]),
});

export const plannedSetSchema = z.object({
  id: nonEmptyStringSchema,
  plannedExerciseId: nonEmptyStringSchema,
  setIndex: positiveIntegerSchema,
  targetReps: positiveIntegerSchema,
  targetLoad: nonNegativeNumberSchema,
  targetRpe: z.number().min(1).max(10).nullable(),
  restSeconds: positiveIntegerSchema.nullable(),
  tempo: optionalNullableStringSchema,
  isAmrap: z.boolean().default(false),
});

export const plannedExerciseSchema = z.object({
  id: nonEmptyStringSchema,
  sessionId: nonEmptyStringSchema,
  liftSlug: liftSlugSchema,
  exerciseSlug: nonEmptyStringSchema,
  exerciseName: nonEmptyStringSchema,
  exerciseOrder: positiveIntegerSchema,
  prescriptionKind: prescriptionKindSchema,
  plannedSets: z.array(plannedSetSchema).min(1),
});

export const plannedSessionSchema = z.object({
  id: nonEmptyStringSchema,
  blockId: nonEmptyStringSchema,
  blockRevisionId: nonEmptyStringSchema,
  scheduledDate: isoDateSchema,
  scheduledWeekday: trainingWeekdaySchema.nullable().default(null),
  sessionIndex: positiveIntegerSchema,
  weekIndex: positiveIntegerSchema,
  sessionType: sessionTypeSchema,
  title: nonEmptyStringSchema,
  status: plannedSessionStatusSchema,
  lpMetadata: plannedSessionLpMetadataSchema.nullable().default(null),
  plannedExercises: z.array(plannedExerciseSchema).min(1),
});

export const workoutResultSchema = z.object({
  id: nonEmptyStringSchema,
  sessionId: nonEmptyStringSchema,
  completedAt: isoDateTimeSchema,
  completionStatus: workoutCompletionStatusSchema,
  notes: optionalNullableStringSchema,
  perceivedDifficulty: z.number().min(1).max(10).nullable(),
});

export const loggedSetResultSchema = z.object({
  id: nonEmptyStringSchema,
  workoutResultId: nonEmptyStringSchema,
  plannedSetId: nonEmptyStringSchema.nullable(),
  setIndex: positiveIntegerSchema,
  actualReps: positiveIntegerSchema.nullable(),
  actualLoad: nonNegativeNumberSchema.nullable(),
  actualRpe: z.number().min(1).max(10).nullable(),
  isCompleted: z.boolean(),
});

export const adaptationEventSchema = z.object({
  id: nonEmptyStringSchema,
  blockId: nonEmptyStringSchema,
  blockRevisionId: nonEmptyStringSchema.nullable(),
  triggeredAt: isoDateTimeSchema,
  eventType: adaptationEventTypeSchema,
  reasonCode: nonEmptyStringSchema,
  summary: nonEmptyStringSchema,
});

export const explanationRecordSchema = z.object({
  id: nonEmptyStringSchema,
  ownerType: explanationOwnerTypeSchema,
  ownerId: nonEmptyStringSchema,
  createdAt: isoDateTimeSchema,
  headline: nonEmptyStringSchema,
  body: nonEmptyStringSchema,
});

export const lpPhaseDefinitionSchema = z.object({
  phase: lpProgramPhaseSchema,
  durationWeeks: positiveIntegerSchema,
  checkpointType: lpCheckpointTypeSchema.nullable(),
});

export const lpProgramStructureSchema = z.object({
  level: lpProgramLevelSchema,
  phases: z.array(lpPhaseDefinitionSchema).min(1),
});

export const lpProgramStateSchema = z.object({
  id: nonEmptyStringSchema,
  blockId: nonEmptyStringSchema,
  programLevel: lpProgramLevelSchema,
  currentPhase: lpProgramPhaseSchema,
  currentMesocycleIndex: positiveIntegerSchema,
  nextCheckpointType: lpCheckpointTypeSchema.nullable(),
  activeDeloadUntilSessionIndex: positiveIntegerSchema.nullable(),
  lastCheckpointResultId: nonEmptyStringSchema.nullable(),
  updatedAt: isoDateTimeSchema,
});

export const lpLiftProgressionStateSchema = z.object({
  id: nonEmptyStringSchema,
  blockId: nonEmptyStringSchema,
  liftSlug: liftSlugSchema,
  unit: loadUnitSchema,
  currentPhase: lpProgramPhaseSchema,
  effectiveBaselineLoad: z.number().positive(),
  phaseEntryLoad: z.number().positive(),
  currentIncrementTier: progressionTierSchema,
  lastExpectedLoad: nonNegativeNumberSchema.nullable(),
  lastLoggedLoad: nonNegativeNumberSchema.nullable(),
  lastSuccessfulLoad: nonNegativeNumberSchema.nullable(),
  consecutiveSameWeightMisses: z.number().int().min(0),
  lastAuthoritativeWeekIndex: z.number().int().positive().nullable(),
  checkpointWorthOverperformance: z.boolean().default(false),
  updatedAt: isoDateTimeSchema,
});

export const lpCheckpointResultSchema = z.object({
  id: nonEmptyStringSchema,
  blockId: nonEmptyStringSchema,
  sessionId: nonEmptyStringSchema,
  liftSlug: liftSlugSchema,
  checkpointType: lpCheckpointTypeSchema,
  expectedLoad: nonNegativeNumberSchema,
  actualLoad: nonNegativeNumberSchema,
  status: z.enum(["on-track", "behind", "achieved"]),
  createdAt: isoDateTimeSchema,
});

export const lpGoalProgressSchema = z.object({
  id: nonEmptyStringSchema,
  blockId: nonEmptyStringSchema,
  liftSlug: liftSlugSchema,
  targetWeight: z.number().positive(),
  targetTestType: lpCheckpointTypeSchema,
  expectedCheckpointLoad: nonNegativeNumberSchema.nullable(),
  actualCheckpointLoad: nonNegativeNumberSchema.nullable(),
  status: goalProgressStatusSchema,
  remainingDelta: nonNegativeNumberSchema,
  updatedAt: isoDateTimeSchema,
});

export const lpMesocycleExtensionSchema = z.object({
  id: nonEmptyStringSchema,
  blockId: nonEmptyStringSchema,
  triggeredByCheckpointResultId: nonEmptyStringSchema.nullable(),
  addedPhase: lpProgramPhaseSchema,
  addedWeeks: positiveIntegerSchema,
  reason: nonEmptyStringSchema,
  createdAt: isoDateTimeSchema,
});

export const generatedTrainingPlanSchema = z.object({
  block: trainingBlockSchema,
  revision: blockRevisionSchema,
  sessions: z.array(plannedSessionSchema).min(1),
});

export type BenchmarkInput = z.infer<typeof benchmarkInputSchema>;
export type Benchmark = z.infer<typeof benchmarkSchema>;
export type TrainingWeekday = z.infer<typeof trainingWeekdaySchema>;
export type BlockSchedulingPreferences = z.infer<typeof blockSchedulingPreferencesSchema>;
export type ValidatedBlockSchedulingPreferences = z.infer<
  typeof validatedBlockSchedulingPreferencesSchema
>;
export type BlockDurationWeeks = z.infer<typeof blockDurationWeeksSchema>;
export type LiftGoal = z.infer<typeof liftGoalSchema>;
export type LpProgramLevel = z.infer<typeof lpProgramLevelSchema>;
export type LpProgramPhase = z.infer<typeof lpProgramPhaseSchema>;
export type LpCheckpointType = z.infer<typeof lpCheckpointTypeSchema>;
export type ProgressionTier = z.infer<typeof progressionTierSchema>;
export type GoalProgressStatus = z.infer<typeof goalProgressStatusSchema>;
export type TargetLiftGoal = z.infer<typeof targetLiftGoalSchema>;
export type BlockConfiguration = z.infer<typeof blockConfigurationSchema>;
export type ValidatedBlockConfiguration = z.infer<typeof validatedBlockConfigurationSchema>;
export type BenchmarkSnapshotItem = z.infer<typeof benchmarkSnapshotItemSchema>;
export type BenchmarkSnapshot = z.infer<typeof benchmarkSnapshotSchema>;
export type TrainingBlock = z.infer<typeof trainingBlockSchema>;
export type BlockRevision = z.infer<typeof blockRevisionSchema>;
export type PlannedSessionLpMetadata = z.infer<typeof plannedSessionLpMetadataSchema>;
export type PlannedSet = z.infer<typeof plannedSetSchema>;
export type PlannedExercise = z.infer<typeof plannedExerciseSchema>;
export type PlannedSession = z.infer<typeof plannedSessionSchema>;
export type WorkoutResult = z.infer<typeof workoutResultSchema>;
export type LoggedSetResult = z.infer<typeof loggedSetResultSchema>;
export type AdaptationEvent = z.infer<typeof adaptationEventSchema>;
export type ExplanationRecord = z.infer<typeof explanationRecordSchema>;
export type LpPhaseDefinition = z.infer<typeof lpPhaseDefinitionSchema>;
export type LpProgramStructure = z.infer<typeof lpProgramStructureSchema>;
export type LpProgramState = z.infer<typeof lpProgramStateSchema>;
export type LpLiftProgressionState = z.infer<typeof lpLiftProgressionStateSchema>;
export type LpCheckpointResult = z.infer<typeof lpCheckpointResultSchema>;
export type LpGoalProgress = z.infer<typeof lpGoalProgressSchema>;
export type LpMesocycleExtension = z.infer<typeof lpMesocycleExtensionSchema>;
export type GeneratedTrainingPlan = z.infer<typeof generatedTrainingPlanSchema>;
