import { parseWithSchema } from "@/schema/parseWithSchema";

import { assertValidGeneratedTrainingPlan } from "@/features/training-blocks/domain/invariants";
import {
  exerciseCatalog,
  getBenchmarkSourceSlug,
  getExerciseShortLabel,
} from "@/features/training-blocks/domain/exerciseCatalog";
import {
  benchmarkInputSchema,
  type BlockConfiguration,
  type BenchmarkInput,
  type GeneratedTrainingPlan,
  type PlannedExercise,
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
  blockConfiguration: BlockConfiguration;
};

const trainingWeekPrescriptions = [
  { intensity: 0.65, sets: 5, reps: 5, sessionType: "primary" as const },
  { intensity: 0.7, sets: 4, reps: 4, sessionType: "primary" as const },
  { intensity: 0.75, sets: 5, reps: 3, sessionType: "primary" as const },
  { intensity: 0.6, sets: 3, reps: 5, sessionType: "deload" as const },
] as const;

const supportLiftPrescriptions = [
  { intensity: 0.6, sets: 4, reps: 6 },
  { intensity: 0.65, sets: 4, reps: 5 },
  { intensity: 0.7, sets: 5, reps: 4 },
  { intensity: 0.55, sets: 2, reps: 5 },
] as const;

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
  blockConfiguration: BlockConfiguration,
  weekCount: number,
): readonly { scheduledDate: string; scheduledWeekday: TrainingWeekday; weekIndex: number }[] => {
  const selectedWeekdays = [...blockConfiguration.schedulingPreferences.selectedTrainingWeekdays].sort(
    (left, right) => trainingWeekdayOrder.indexOf(left) - trainingWeekdayOrder.indexOf(right),
  );
  const selectedWeekdaySet = new Set(selectedWeekdays);
  const scheduledDates: { scheduledDate: string; scheduledWeekday: TrainingWeekday; weekIndex: number }[] = [];
  let cursorDate = startDate;

  while (scheduledDates.length < blockConfiguration.schedulingPreferences.trainingDaysPerWeek * weekCount) {
    const weekday = getTrainingWeekdayFromIsoDate(cursorDate);

    if (selectedWeekdaySet.has(weekday)) {
      scheduledDates.push({
        scheduledDate: cursorDate,
        scheduledWeekday: weekday,
        weekIndex:
          Math.floor(
            scheduledDates.length / blockConfiguration.schedulingPreferences.trainingDaysPerWeek,
          ) + 1,
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

const getWeekPrescription = (weekIndex: number, durationWeeks: number) => {
  if (weekIndex === durationWeeks) {
    return trainingWeekPrescriptions.at(-1) ?? trainingWeekPrescriptions[0];
  }

  return trainingWeekPrescriptions[(weekIndex - 1) % 3] ?? trainingWeekPrescriptions[0];
};

const benchmarkRepsByType: Record<BenchmarkInput["benchmarkType"], number> = {
  "one-rep-max": 1,
  "three-rep-max": 3,
  "five-rep-max": 5,
  "working-weight": 5,
};

const pickUniqueLiftSequence = (
  pool: readonly BenchmarkInput["liftSlug"][],
  count: number,
  startOffset: number,
  excludedLiftSlugs: readonly BenchmarkInput["liftSlug"][] = [],
): readonly BenchmarkInput["liftSlug"][] => {
  const uniquePool = pool.filter((liftSlug, index) => pool.indexOf(liftSlug) === index);
  const excluded = new Set(excludedLiftSlugs);
  const results: BenchmarkInput["liftSlug"][] = [];

  for (let offset = 0; offset < uniquePool.length && results.length < count; offset += 1) {
    const liftSlug = uniquePool[(startOffset + offset) % uniquePool.length];

    if (liftSlug === undefined || excluded.has(liftSlug) || results.includes(liftSlug)) {
      continue;
    }

    results.push(liftSlug);
  }

  return results;
};

const createExercise = (input: {
  planKey: string;
  sessionId: string;
  exerciseOrder: number;
  liftSlug: BenchmarkInput["liftSlug"];
  exerciseName: string;
  prescriptionKind: PlannedExercise["prescriptionKind"];
  sets: number;
  reps: number;
  targetLoad: number;
  targetRpe: number | null;
  restSeconds: number | null;
  isAmrap?: boolean;
}): PlannedExercise => {
  const plannedExerciseId = makeStableId("exercise", input.sessionId, String(input.exerciseOrder));

  return {
    id: plannedExerciseId,
    sessionId: input.sessionId,
    liftSlug: input.liftSlug,
    exerciseSlug: input.liftSlug,
    exerciseName: input.exerciseName,
    exerciseOrder: input.exerciseOrder,
    prescriptionKind: input.prescriptionKind,
    plannedSets: Array.from({ length: input.sets }, (_, setIndex) => ({
      id: makeStableId("set", plannedExerciseId, String(setIndex + 1)),
      plannedExerciseId,
      setIndex: setIndex + 1,
      targetReps: input.reps,
      targetLoad: input.targetLoad,
      targetRpe: input.targetRpe,
      restSeconds: input.restSeconds,
      tempo: null,
      isAmrap: input.isAmrap ?? false,
    })),
  };
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
    options.goalSlug ?? options.blockConfiguration.primaryGoal,
    primaryLiftSlug,
    String(options.blockConfiguration.schedulingPreferences.trainingDaysPerWeek),
    String(options.blockConfiguration.durationWeeks),
    options.blockConfiguration.primaryGoal,
    options.blockConfiguration.secondaryGoal,
    options.blockConfiguration.schedulingPreferences.selectedTrainingWeekdays.join(","),
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
  const benchmarkByLiftSlug = new Map(
    normalizedBenchmarks.map((benchmark) => [benchmark.liftSlug, benchmark] as const),
  );
  const trainingMaxByLiftSlug = new Map(
    trainingMaxes.map((trainingMax) => [trainingMax.liftSlug, trainingMax] as const),
  );

  if (primaryTrainingMax === undefined) {
    throw new Error(
      `[training-blocks.generator] Missing training max for primary lift ${primaryLiftSlug}.`,
    );
  }

  const supportTrainingMaxes = trainingMaxes.filter(
    (trainingMax) => trainingMax.liftSlug !== primaryLiftSlug,
  );
  if (supportTrainingMaxes.length === 0) {
    throw new Error("[training-blocks.generator] At least one non-primary lift is required.");
  }

  const scheduledDates = buildScheduledDates(
    options.startDate,
    options.blockConfiguration,
    options.blockConfiguration.durationWeeks,
  );
  const lastSessionIndex = scheduledDates.length;
  const sessions = scheduledDates.map((scheduledSlot, scheduledSlotIndex) => {
    const sessionIndex = scheduledSlotIndex + 1;
    const sessionId = makeStableId("session", planKey, String(sessionIndex));
    const isBenchmarkSession = sessionIndex === 1;
    const isFinalTestSession = sessionIndex === lastSessionIndex;
    const weekPrescription = getWeekPrescription(
      scheduledSlot.weekIndex,
      options.blockConfiguration.durationWeeks,
    );
    const supportPrescription =
      supportLiftPrescriptions[(scheduledSlot.weekIndex - 1) % supportLiftPrescriptions.length] ??
      supportLiftPrescriptions[0];

    if (isBenchmarkSession || isFinalTestSession) {
      const plannedExercises = options.blockConfiguration.benchmarkLiftSlugs.map(
        (liftSlug, exerciseIndex) => {
          const benchmark = benchmarkByLiftSlug.get(liftSlug);

          if (benchmark === undefined) {
            throw new Error(
              `[training-blocks.generator] Missing saved benchmark input for ${liftSlug}.`,
            );
          }

          return createExercise({
            planKey,
            sessionId,
            exerciseOrder: exerciseIndex + 1,
            liftSlug,
            exerciseName: getExerciseShortLabel(liftSlug),
            prescriptionKind: "fixed-sets",
            sets: 1,
            reps: benchmarkRepsByType[benchmark.benchmarkType],
            targetLoad: roundToLoadIncrement(benchmark.value, benchmark.unit),
            targetRpe: null,
            restSeconds: 180,
          });
        },
      );

      return {
        id: sessionId,
        blockId,
        blockRevisionId: revisionId,
        scheduledDate: scheduledSlot.scheduledDate,
        scheduledWeekday: scheduledSlot.scheduledWeekday,
        sessionIndex,
        weekIndex: scheduledSlot.weekIndex,
        sessionType: isBenchmarkSession ? ("benchmark" as const) : ("final-test" as const),
        title: isBenchmarkSession
          ? `Benchmark Session Week ${scheduledSlot.weekIndex}`
          : `Final Test Session Week ${scheduledSlot.weekIndex}`,
        status: "planned" as const,
        lpMetadata: null,
        plannedExercises,
      };
    }

    const primaryLiftSlugs = pickUniqueLiftSequence(
      options.blockConfiguration.primaryLiftPool,
      options.blockConfiguration.primaryLiftsPerSession,
      scheduledSlotIndex,
    );
    const secondaryLiftSlugs = pickUniqueLiftSequence(
      options.blockConfiguration.secondaryLiftPool,
      options.blockConfiguration.secondaryLiftsPerSession,
      scheduledSlotIndex,
      primaryLiftSlugs,
    );
    const leadLiftSlug = primaryLiftSlugs[0] ?? primaryLiftSlug;
    const sessionType =
      scheduledSlot.weekIndex === options.blockConfiguration.durationWeeks
        ? ("deload" as const)
        : scheduledSlotIndex % options.blockConfiguration.schedulingPreferences.trainingDaysPerWeek ===
            0
          ? ("primary" as const)
          : ("secondary" as const);
    const plannedExercises = [
      ...primaryLiftSlugs.map((liftSlug, exerciseIndex) => {
        const trainingMax = trainingMaxByLiftSlug.get(getBenchmarkSourceSlug(liftSlug));

        if (trainingMax === undefined) {
          throw new Error(`[training-blocks.generator] Missing training max for ${liftSlug}.`);
        }

        return createExercise({
          planKey,
          sessionId,
          exerciseOrder: exerciseIndex + 1,
          liftSlug,
          exerciseName: getExerciseShortLabel(liftSlug),
          prescriptionKind: "fixed-sets",
          sets: weekPrescription.sets,
          reps: weekPrescription.reps,
          targetLoad: roundToLoadIncrement(
            Number((trainingMax.trainingMax * weekPrescription.intensity).toFixed(2)),
            trainingMax.sourceUnit,
          ),
          targetRpe: scheduledSlot.weekIndex === options.blockConfiguration.durationWeeks ? 6 : 7,
          restSeconds: liftSlug === "deadlift" ? 180 : 150,
        });
      }),
      ...secondaryLiftSlugs.map((liftSlug, exerciseIndex) => {
        const trainingMax = trainingMaxByLiftSlug.get(getBenchmarkSourceSlug(liftSlug));

        if (trainingMax === undefined) {
          throw new Error(`[training-blocks.generator] Missing training max for ${liftSlug}.`);
        }

        return createExercise({
          planKey,
          sessionId,
          exerciseOrder: primaryLiftSlugs.length + exerciseIndex + 1,
          liftSlug,
          exerciseName: exerciseCatalog[liftSlug].defaultSupportLabel ?? `${getExerciseShortLabel(liftSlug)} Support`,
          prescriptionKind: "fixed-sets",
          sets: supportPrescription.sets,
          reps: supportPrescription.reps,
          targetLoad: roundToLoadIncrement(
            Number((trainingMax.trainingMax * supportPrescription.intensity).toFixed(2)),
            trainingMax.sourceUnit,
          ),
          targetRpe: scheduledSlot.weekIndex === options.blockConfiguration.durationWeeks ? 6 : 7,
          restSeconds: liftSlug === "deadlift" ? 180 : 120,
        });
      }),
    ];

    return {
      id: sessionId,
      blockId,
      blockRevisionId: revisionId,
      scheduledDate: scheduledSlot.scheduledDate,
      scheduledWeekday: scheduledSlot.scheduledWeekday,
      sessionIndex,
      weekIndex: scheduledSlot.weekIndex,
      sessionType,
      title:
        sessionType === "primary"
          ? `${getExerciseShortLabel(leadLiftSlug)} Primary Week ${scheduledSlot.weekIndex}`
          : sessionType === "deload"
            ? `${getExerciseShortLabel(leadLiftSlug)} Deload Week ${scheduledSlot.weekIndex}`
            : `${getExerciseShortLabel(leadLiftSlug)} Support Week ${scheduledSlot.weekIndex}`,
      status: "planned" as const,
      lpMetadata: null,
      plannedExercises,
    };
  });
  const lastScheduledDate = scheduledDates.at(-1)?.scheduledDate ?? addDays(options.startDate, 27);

  return assertValidGeneratedTrainingPlan({
    block: {
      id: blockId,
      name: options.blockName ?? "Starter Strength Block",
      status: "draft",
      goalSlug: options.goalSlug ?? options.blockConfiguration.primaryGoal,
      startDate: options.startDate,
      endDate: lastScheduledDate,
      benchmarkSnapshotId,
      generationVersion: "v1-fixed-benchmark-block",
      createdAt,
      updatedAt: createdAt,
      schedulingPreferences: options.blockConfiguration.schedulingPreferences,
      blockConfiguration: options.blockConfiguration,
      notes: `Generated from local benchmark inputs with ${getExerciseShortLabel(primaryLiftSlug)} as the primary lift focus over ${options.blockConfiguration.durationWeeks} weeks.`,
    },
    revision: {
      id: revisionId,
      blockId,
      revisionNumber: 1,
      reason: "initial-generation",
      summary: `Initial ${options.blockConfiguration.durationWeeks}-week block generated from saved benchmark inputs and setup configuration.`,
      createdAt,
    },
    sessions,
  });
};

export type { FixedBlockGeneratorOptions };
