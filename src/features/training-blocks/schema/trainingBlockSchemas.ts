import { z } from "zod";

import {
  nonEmptyStringSchema,
  optionalNullableStringSchema,
  trimmedStringSchema,
} from "@/schema/primitives";

const isoDateSchema = z.iso.date();
const isoDateTimeSchema = z.iso.datetime();
const positiveIntegerSchema = z.number().int().positive();
const nonNegativeNumberSchema = z.number().nonnegative();

export const liftSlugSchema = z.enum([
  "back-squat",
  "bench-press",
  "deadlift",
  "overhead-press",
]);

export const benchmarkTypeSchema = z.enum([
  "one-rep-max",
  "three-rep-max",
  "five-rep-max",
  "working-weight",
]);

export const loadUnitSchema = z.enum(["kg", "lb"]);

export const trainingBlockStatusSchema = z.enum(["draft", "active", "completed", "archived"]);
export const sessionTypeSchema = z.enum(["primary", "secondary", "deload", "benchmark"]);
export const plannedSessionStatusSchema = z.enum(["planned", "completed", "skipped"]);
export const prescriptionKindSchema = z.enum(["fixed-sets", "top-set-backoff", "amrap"]);
export const workoutCompletionStatusSchema = z.enum(["completed", "partial", "missed"]);
export const adaptationEventTypeSchema = z.enum([
  "generation",
  "progression-adjustment",
  "deload-adjustment",
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
});

export const blockRevisionSchema = z.object({
  id: nonEmptyStringSchema,
  blockId: nonEmptyStringSchema,
  revisionNumber: positiveIntegerSchema,
  reason: nonEmptyStringSchema,
  summary: nonEmptyStringSchema,
  createdAt: isoDateTimeSchema,
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
  sessionIndex: positiveIntegerSchema,
  weekIndex: positiveIntegerSchema,
  sessionType: sessionTypeSchema,
  title: nonEmptyStringSchema,
  status: plannedSessionStatusSchema,
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

export const generatedTrainingPlanSchema = z.object({
  block: trainingBlockSchema,
  revision: blockRevisionSchema,
  sessions: z.array(plannedSessionSchema).min(1),
});

export type BenchmarkInput = z.infer<typeof benchmarkInputSchema>;
export type Benchmark = z.infer<typeof benchmarkSchema>;
export type BenchmarkSnapshotItem = z.infer<typeof benchmarkSnapshotItemSchema>;
export type BenchmarkSnapshot = z.infer<typeof benchmarkSnapshotSchema>;
export type TrainingBlock = z.infer<typeof trainingBlockSchema>;
export type BlockRevision = z.infer<typeof blockRevisionSchema>;
export type PlannedSet = z.infer<typeof plannedSetSchema>;
export type PlannedExercise = z.infer<typeof plannedExerciseSchema>;
export type PlannedSession = z.infer<typeof plannedSessionSchema>;
export type WorkoutResult = z.infer<typeof workoutResultSchema>;
export type LoggedSetResult = z.infer<typeof loggedSetResultSchema>;
export type AdaptationEvent = z.infer<typeof adaptationEventSchema>;
export type ExplanationRecord = z.infer<typeof explanationRecordSchema>;
export type GeneratedTrainingPlan = z.infer<typeof generatedTrainingPlanSchema>;
