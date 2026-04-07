import { parseWithSchema } from "@/schema/parseWithSchema";

import { assertValidGeneratedTrainingPlan } from "@/features/training-blocks/domain/invariants";
import {
  benchmarkInputSchema,
  type BlockSchedulingPreferences,
  type BenchmarkInput,
  type GeneratedTrainingPlan,
  type TrainingWeekday,
} from "@/features/training-blocks/schema/trainingBlockSchemas";
import { trainingWeekdayOrder } from "@/features/training-blocks/services/blockSchedulingService";
import { deriveTrainingMaxes, roundToLoadIncrement } from "@/features/training-blocks/services/trainingMaxService";

type FixedBlockGeneratorOptions = {
  startDate: string;
  blockName?: string;
  goalSlug?: string;
  primaryLiftSlug?: BenchmarkInput["liftSlug"];
};

type FixedBlockGenerationInput = FixedBlockGeneratorOptions & {
  schedulingPreferences: BlockSchedulingPreferences;
};

const microcyclePrescriptions = [
  { weekIndex: 1, intensity: 0.65, sets: 5, reps: 5, sessionType: "primary" as const },
  { weekIndex: 2, intensity: 0.7, sets: 4, reps: 4, sessionType: "primary" as const },
  { weekIndex: 3, intensity: 0.75, sets: 5, reps: 3, sessionType: "primary" as const },
  { weekIndex: 4, intensity: 0.6, sets: 3, reps: 5, sessionType: "deload" as const },
] as const;

const supportLiftPrescriptions = [
  { weekIndex: 1, intensity: 0.6, sets: 4, reps: 6 },
  { weekIndex: 2, intensity: 0.65, sets: 4, reps: 5 },
  { weekIndex: 3, intensity: 0.7, sets: 5, reps: 4 },
  { weekIndex: 4, intensity: 0.55, sets: 2, reps: 5 },
] as const;

const liftDisplayNameBySlug = {
  "back-squat": "Back Squat",
  "bench-press": "Bench Press",
  deadlift: "Deadlift",
  "overhead-press": "Overhead Press",
} as const;

const defaultPrimaryLiftPriority: readonly BenchmarkInput["liftSlug"][] = [
  "back-squat",
  "bench-press",
  "deadlift",
  "overhead-press",
] as const;

const addDays = (isoDate: string, days: number): string => {
  const date = new Date(`${isoDate}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
};

const getTrainingWeekdayFromIsoDate = (isoDate: string): TrainingWeekday => {
  const weekdayIndex = new Date(`${isoDate}T00:00:00.000Z`).getUTCDay();
  const weekdayByJavascriptIndex: Record<number, TrainingWeekday> = {
    0: "sunday",
    1: "monday",
    2: "tuesday",
    3: "wednesday",
    4: "thursday",
    5: "friday",
    6: "saturday",
  };

  const weekday = weekdayByJavascriptIndex[weekdayIndex];

  if (weekday === undefined) {
    throw new Error(`[training-blocks.generator] Unsupported weekday index ${weekdayIndex}.`);
  }

  return weekday;
};

const hashString = (value: string): string => {
  let hash = 2166136261;

  for (const character of value) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }

  return Math.abs(hash >>> 0).toString(36);
};

const makeStableId = (prefix: string, ...parts: readonly string[]): string => {
  return `${prefix}_${hashString(parts.join("|"))}`;
};

const buildScheduledDates = (
  startDate: string,
  schedulingPreferences: BlockSchedulingPreferences,
  weekCount: number,
): readonly { scheduledDate: string; scheduledWeekday: TrainingWeekday; weekIndex: number }[] => {
  const selectedWeekdays = [...schedulingPreferences.selectedTrainingWeekdays].sort(
    (left, right) => trainingWeekdayOrder.indexOf(left) - trainingWeekdayOrder.indexOf(right),
  );
  const selectedWeekdaySet = new Set(selectedWeekdays);
  const scheduledDates: { scheduledDate: string; scheduledWeekday: TrainingWeekday; weekIndex: number }[] = [];
  let cursorDate = startDate;

  while (scheduledDates.length < schedulingPreferences.trainingDaysPerWeek * weekCount) {
    const weekday = getTrainingWeekdayFromIsoDate(cursorDate);

    if (selectedWeekdaySet.has(weekday)) {
      scheduledDates.push({
        scheduledDate: cursorDate,
        scheduledWeekday: weekday,
        weekIndex: Math.floor(scheduledDates.length / schedulingPreferences.trainingDaysPerWeek) + 1,
      });
    }

    cursorDate = addDays(cursorDate, 1);
  }

  return scheduledDates;
};

const getPrimaryLiftSlug = (
  normalizedBenchmarks: readonly BenchmarkInput[],
  requestedPrimaryLiftSlug?: BenchmarkInput["liftSlug"],
): BenchmarkInput["liftSlug"] => {
  if (
    requestedPrimaryLiftSlug !== undefined &&
    normalizedBenchmarks.some((benchmark) => benchmark.liftSlug === requestedPrimaryLiftSlug)
  ) {
    return requestedPrimaryLiftSlug;
  }

  const fallbackPrimaryLiftSlug = defaultPrimaryLiftPriority.find((liftSlug) =>
    normalizedBenchmarks.some((benchmark) => benchmark.liftSlug === liftSlug),
  );

  if (fallbackPrimaryLiftSlug === undefined) {
    throw new Error("[training-blocks.generator] No supported primary lift was provided.");
  }

  return fallbackPrimaryLiftSlug;
};

export const generateFixedTrainingBlock = (
  benchmarks: readonly BenchmarkInput[],
  options: FixedBlockGenerationInput,
): GeneratedTrainingPlan => {
  const normalizedBenchmarks = benchmarks
    .map((benchmark) =>
      parseWithSchema(benchmarkInputSchema, benchmark, "training-blocks.generator-input"),
    )
    .sort((left, right) => left.liftSlug.localeCompare(right.liftSlug));
  const trainingMaxes = deriveTrainingMaxes(normalizedBenchmarks);
  const primaryLiftSlug = getPrimaryLiftSlug(normalizedBenchmarks, options.primaryLiftSlug);
  const planKey = [
    options.startDate,
    options.goalSlug ?? "general-strength",
    primaryLiftSlug,
    String(options.schedulingPreferences.trainingDaysPerWeek),
    options.schedulingPreferences.selectedTrainingWeekdays.join(","),
    ...normalizedBenchmarks.map(
      (benchmark) =>
        `${benchmark.liftSlug}:${benchmark.benchmarkType}:${benchmark.value}:${benchmark.unit}`,
    ),
  ].join("|");
  const blockId = makeStableId("block", planKey);
  const revisionId = makeStableId("revision", planKey, "1");
  const benchmarkSnapshotId = makeStableId("benchmark_snapshot", planKey);
  const createdAt = new Date().toISOString();
  const primaryTrainingMax = trainingMaxes.find(
    (trainingMax) => trainingMax.liftSlug === primaryLiftSlug,
  );

  if (primaryTrainingMax === undefined) {
    throw new Error(
      `[training-blocks.generator] Missing training max for primary lift ${primaryLiftSlug}.`,
    );
  }

  const supportTrainingMaxes = trainingMaxes.filter(
    (trainingMax) => trainingMax.liftSlug !== primaryLiftSlug,
  );
  const scheduledDates = buildScheduledDates(options.startDate, options.schedulingPreferences, microcyclePrescriptions.length);
  const sessions = microcyclePrescriptions.flatMap((prescription, weekIndex) => {
    const supportPrescription = supportLiftPrescriptions[weekIndex];

    if (supportPrescription === undefined) {
      throw new Error(
        `[training-blocks.generator] Missing support prescription for week ${prescription.weekIndex}.`,
      );
    }

    return Array.from({ length: options.schedulingPreferences.trainingDaysPerWeek }, (_, sessionOffset) => {
      const sessionIndex = weekIndex * options.schedulingPreferences.trainingDaysPerWeek + sessionOffset + 1;
      const scheduledSlot = scheduledDates[sessionIndex - 1];

      if (scheduledSlot === undefined) {
        throw new Error(`[training-blocks.generator] Missing scheduled date slot for session ${sessionIndex}.`);
      }

      const isPrimarySession = sessionOffset === 0;
      const trainingMax = isPrimarySession
        ? primaryTrainingMax
        : supportTrainingMaxes[(weekIndex * Math.max(options.schedulingPreferences.trainingDaysPerWeek - 1, 1) + sessionOffset - 1) % supportTrainingMaxes.length];
      if (trainingMax === undefined) {
        throw new Error("[training-blocks.generator] Missing support training max for scheduled support session.");
      }
      const sessionType = isPrimarySession
        ? prescription.sessionType
        : prescription.weekIndex === 4
          ? ("deload" as const)
          : ("secondary" as const);
      const sets = isPrimarySession ? prescription.sets : supportPrescription.sets;
      const reps = isPrimarySession ? prescription.reps : supportPrescription.reps;
      const intensity = isPrimarySession ? prescription.intensity : supportPrescription.intensity;
      const sessionId = makeStableId("session", planKey, String(sessionIndex));
      const plannedExerciseId = makeStableId("exercise", sessionId, "1");
      const roundedLoad = roundToLoadIncrement(
        Number((trainingMax.trainingMax * intensity).toFixed(2)),
        trainingMax.sourceUnit,
      );

      return {
        id: sessionId,
        blockId,
        blockRevisionId: revisionId,
        scheduledDate: scheduledSlot.scheduledDate,
        scheduledWeekday: scheduledSlot.scheduledWeekday,
        sessionIndex,
        weekIndex: scheduledSlot.weekIndex,
        sessionType,
        title: isPrimarySession
          ? `${liftDisplayNameBySlug[primaryTrainingMax.liftSlug]} Primary Week ${prescription.weekIndex}`
          : `${liftDisplayNameBySlug[trainingMax.liftSlug]} Support Week ${prescription.weekIndex}`,
        status: "planned" as const,
        plannedExercises: [
          {
            id: plannedExerciseId,
            sessionId,
            liftSlug: trainingMax.liftSlug,
            exerciseSlug: trainingMax.liftSlug,
            exerciseName: liftDisplayNameBySlug[trainingMax.liftSlug],
            exerciseOrder: 1,
            prescriptionKind: "fixed-sets" as const,
            plannedSets: Array.from({ length: sets }, (_, setIndex) => ({
              id: makeStableId("set", plannedExerciseId, String(setIndex + 1)),
              plannedExerciseId,
              setIndex: setIndex + 1,
              targetReps: reps,
              targetLoad: roundedLoad,
              targetRpe: prescription.weekIndex === 4 ? 6 : 7,
              restSeconds: trainingMax.liftSlug === "deadlift" ? 180 : 150,
              tempo: null,
              isAmrap: false,
            })),
          },
        ],
      };
    });
  });
  const lastScheduledDate = scheduledDates.at(-1)?.scheduledDate ?? addDays(options.startDate, 27);

  return assertValidGeneratedTrainingPlan({
    block: {
      id: blockId,
      name: options.blockName ?? "Starter Strength Block",
      status: "draft",
      goalSlug: options.goalSlug ?? "general-strength",
      startDate: options.startDate,
      endDate: lastScheduledDate,
      benchmarkSnapshotId,
      generationVersion: "v1-fixed-benchmark-block",
      createdAt,
      updatedAt: createdAt,
      schedulingPreferences: options.schedulingPreferences,
      notes: `Generated from local benchmark inputs with ${liftDisplayNameBySlug[primaryLiftSlug]} as the primary lift focus.`,
    },
    revision: {
      id: revisionId,
      blockId,
      revisionNumber: 1,
      reason: "initial-generation",
      summary: "Initial 4-week fixed block generated from saved benchmark inputs.",
      createdAt,
    },
    sessions,
  });
};

export type { FixedBlockGeneratorOptions };
