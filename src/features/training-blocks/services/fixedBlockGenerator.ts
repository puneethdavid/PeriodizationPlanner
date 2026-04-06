import { parseWithSchema } from "@/schema/parseWithSchema";

import { assertValidGeneratedTrainingPlan } from "@/features/training-blocks/domain/invariants";
import {
  benchmarkInputSchema,
  type BenchmarkInput,
  type GeneratedTrainingPlan,
} from "@/features/training-blocks/schema/trainingBlockSchemas";
import { deriveTrainingMaxes } from "@/features/training-blocks/services/trainingMaxService";

type FixedBlockGeneratorOptions = {
  startDate: string;
  blockName?: string;
  goalSlug?: string;
  primaryLiftSlug?: BenchmarkInput["liftSlug"];
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
  options: FixedBlockGeneratorOptions,
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
  const sessions = microcyclePrescriptions.flatMap((prescription, weekIndex) => {
    const supportPrescription = supportLiftPrescriptions[weekIndex];

    if (supportPrescription === undefined) {
      throw new Error(
        `[training-blocks.generator] Missing support prescription for week ${prescription.weekIndex}.`,
      );
    }

    const weeklySessions = [
      {
        trainingMax: primaryTrainingMax,
        sessionType: prescription.sessionType,
        title: `${liftDisplayNameBySlug[primaryTrainingMax.liftSlug]} Primary Week ${
          prescription.weekIndex
        }`,
        dayOffset: weekIndex * 7,
        sets: prescription.sets,
        reps: prescription.reps,
        intensity: prescription.intensity,
      },
      ...supportTrainingMaxes.map((trainingMax, supportIndex) => ({
        trainingMax,
        sessionType:
          prescription.weekIndex === 4
            ? ("deload" as const)
            : ("secondary" as const),
        title: `${liftDisplayNameBySlug[trainingMax.liftSlug]} Support Week ${
          prescription.weekIndex
        }`,
        dayOffset: weekIndex * 7 + supportIndex + 2,
        sets: supportPrescription.sets,
        reps: supportPrescription.reps,
        intensity: supportPrescription.intensity,
      })),
    ];

    return weeklySessions.map((sessionDefinition, sessionOffset) => {
      const sessionIndex = weekIndex * weeklySessions.length + sessionOffset + 1;
      const sessionId = makeStableId("session", planKey, String(sessionIndex));
      const plannedExerciseId = makeStableId("exercise", sessionId, "1");
      const roundedLoad = Number(
        (sessionDefinition.trainingMax.trainingMax * sessionDefinition.intensity).toFixed(2),
      );

      return {
        id: sessionId,
        blockId,
        blockRevisionId: revisionId,
        scheduledDate: addDays(options.startDate, sessionDefinition.dayOffset),
        sessionIndex,
        weekIndex: prescription.weekIndex,
        sessionType: sessionDefinition.sessionType,
        title: sessionDefinition.title,
        status: "planned" as const,
        plannedExercises: [
          {
            id: plannedExerciseId,
            sessionId,
            liftSlug: sessionDefinition.trainingMax.liftSlug,
            exerciseSlug: sessionDefinition.trainingMax.liftSlug,
            exerciseName: liftDisplayNameBySlug[sessionDefinition.trainingMax.liftSlug],
            exerciseOrder: 1,
            prescriptionKind: "fixed-sets" as const,
            plannedSets: Array.from({ length: sessionDefinition.sets }, (_, setIndex) => ({
              id: makeStableId("set", plannedExerciseId, String(setIndex + 1)),
              plannedExerciseId,
              setIndex: setIndex + 1,
              targetReps: sessionDefinition.reps,
              targetLoad: roundedLoad,
              targetRpe: prescription.weekIndex === 4 ? 6 : 7,
              restSeconds:
                sessionDefinition.trainingMax.liftSlug === "deadlift" ? 180 : 150,
              tempo: null,
              isAmrap: false,
            })),
          },
        ],
      };
    });
  });

  return assertValidGeneratedTrainingPlan({
    block: {
      id: blockId,
      name: options.blockName ?? "Starter Strength Block",
      status: "draft",
      goalSlug: options.goalSlug ?? "general-strength",
      startDate: options.startDate,
      endDate: addDays(options.startDate, 27),
      benchmarkSnapshotId,
      generationVersion: "v1-fixed-benchmark-block",
      createdAt,
      updatedAt: createdAt,
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
