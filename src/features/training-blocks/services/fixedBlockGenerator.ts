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
};

const microcyclePrescriptions = [
  { weekIndex: 1, intensity: 0.65, sets: 5, reps: 5, sessionType: "primary" as const },
  { weekIndex: 2, intensity: 0.7, sets: 4, reps: 4, sessionType: "primary" as const },
  { weekIndex: 3, intensity: 0.75, sets: 5, reps: 3, sessionType: "primary" as const },
  { weekIndex: 4, intensity: 0.6, sets: 3, reps: 5, sessionType: "deload" as const },
] as const;

const liftDisplayNameBySlug = {
  "back-squat": "Back Squat",
  "bench-press": "Bench Press",
  deadlift: "Deadlift",
  "overhead-press": "Overhead Press",
} as const;

const addDays = (isoDate: string, days: number): string => {
  const date = new Date(`${isoDate}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
};

const makeId = (prefix: string): string => `${prefix}_${crypto.randomUUID()}`;

export const generateFixedTrainingBlock = (
  benchmarks: readonly BenchmarkInput[],
  options: FixedBlockGeneratorOptions,
): GeneratedTrainingPlan => {
  const normalizedBenchmarks = benchmarks.map((benchmark) =>
    parseWithSchema(benchmarkInputSchema, benchmark, "training-blocks.generator-input"),
  );
  const trainingMaxes = deriveTrainingMaxes(normalizedBenchmarks);
  const blockId = makeId("block");
  const revisionId = makeId("revision");
  const benchmarkSnapshotId = makeId("benchmark_snapshot");
  const createdAt = new Date().toISOString();
  const sessions = trainingMaxes.flatMap((trainingMax, liftIndex) =>
    microcyclePrescriptions.map((prescription, prescriptionIndex) => {
      const sessionId = makeId("session");
      const plannedExerciseId = makeId("exercise");
      const scheduledDate = addDays(options.startDate, prescriptionIndex * 7 + liftIndex);
      const roundedLoad = Number(
        (trainingMax.trainingMax * prescription.intensity).toFixed(2),
      );

      return {
        id: sessionId,
        blockId,
        blockRevisionId: revisionId,
        scheduledDate,
        sessionIndex: liftIndex * microcyclePrescriptions.length + prescriptionIndex + 1,
        weekIndex: prescription.weekIndex,
        sessionType: prescription.sessionType,
        title: `${liftDisplayNameBySlug[trainingMax.liftSlug]} Week ${prescription.weekIndex}`,
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
            plannedSets: Array.from({ length: prescription.sets }, (_, setIndex) => ({
              id: makeId("set"),
              plannedExerciseId,
              setIndex: setIndex + 1,
              targetReps: prescription.reps,
              targetLoad: roundedLoad,
              targetRpe: prescription.weekIndex === 4 ? 6 : 7,
              restSeconds: trainingMax.liftSlug === "deadlift" ? 180 : 150,
              tempo: null,
              isAmrap: false,
            })),
          },
        ],
      };
    }),
  );

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
      notes: "Generated from local benchmark inputs using deterministic fixed progression.",
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
