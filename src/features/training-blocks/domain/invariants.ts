import { parseWithSchema } from "@/schema/parseWithSchema";

import {
  benchmarkSnapshotSchema,
  generatedTrainingPlanSchema,
  type Benchmark,
  type BenchmarkSnapshot,
  type GeneratedTrainingPlan,
  type PlannedExercise,
  type PlannedSession,
  type PlannedSet,
} from "@/features/training-blocks/schema/trainingBlockSchemas";

const assertSequentialIndexes = (
  values: readonly number[],
  boundaryName: string,
  entityLabel: string,
): void => {
  values.forEach((value, index) => {
    if (value !== index + 1) {
      throw new Error(
        `[${boundaryName}] ${entityLabel} indexes must be sequential starting at 1; expected ${
          index + 1
        } but received ${value}.`,
      );
    }
  });
};

const assertPlannedSets = (plannedSets: readonly PlannedSet[], boundaryName: string): void => {
  assertSequentialIndexes(
    plannedSets.map((plannedSet) => plannedSet.setIndex),
    boundaryName,
    "Planned set",
  );
};

const assertPlannedExercises = (
  plannedExercises: readonly PlannedExercise[],
  sessionId: string,
  boundaryName: string,
): void => {
  assertSequentialIndexes(
    plannedExercises.map((plannedExercise) => plannedExercise.exerciseOrder),
    boundaryName,
    "Planned exercise",
  );

  plannedExercises.forEach((plannedExercise) => {
    if (plannedExercise.sessionId !== sessionId) {
      throw new Error(
        `[${boundaryName}] Planned exercise ${plannedExercise.id} must belong to session ${sessionId}.`,
      );
    }

    assertPlannedSets(plannedExercise.plannedSets, boundaryName);
  });
};

const assertPlannedSessions = (
  sessions: readonly PlannedSession[],
  blockId: string,
  blockRevisionId: string,
  boundaryName: string,
): void => {
  assertSequentialIndexes(
    sessions.map((session) => session.sessionIndex),
    boundaryName,
    "Planned session",
  );

  sessions.forEach((session) => {
    if (session.blockId !== blockId) {
      throw new Error(`[${boundaryName}] Session ${session.id} must belong to block ${blockId}.`);
    }

    if (session.blockRevisionId !== blockRevisionId) {
      throw new Error(
        `[${boundaryName}] Session ${session.id} must belong to block revision ${blockRevisionId}.`,
      );
    }

    assertPlannedExercises(session.plannedExercises, session.id, boundaryName);
  });
};

export const assertValidBenchmarkCollection = (benchmarks: readonly Benchmark[]): void => {
  const seenLifts = new Set<string>();

  benchmarks.forEach((benchmark) => {
    if (seenLifts.has(benchmark.liftSlug)) {
      throw new Error(
        `[training-blocks] Duplicate benchmark detected for lift ${benchmark.liftSlug}.`,
      );
    }

    seenLifts.add(benchmark.liftSlug);
  });
};

export const assertValidBenchmarkSnapshot = (input: BenchmarkSnapshot): BenchmarkSnapshot => {
  const snapshot = parseWithSchema(
    benchmarkSnapshotSchema,
    input,
    "training-blocks.benchmark-snapshot",
  );
  const seenLifts = new Set<string>();

  snapshot.items.forEach((item) => {
    if (seenLifts.has(item.liftSlug)) {
      throw new Error(
        `[training-blocks.benchmark-snapshot] Snapshot ${snapshot.id} contains duplicate lift ${item.liftSlug}.`,
      );
    }

    seenLifts.add(item.liftSlug);
  });

  return snapshot;
};

export const assertValidGeneratedTrainingPlan = (
  input: GeneratedTrainingPlan,
): GeneratedTrainingPlan => {
  const plan = parseWithSchema(generatedTrainingPlanSchema, input, "training-blocks.plan");

  if (plan.block.startDate > plan.block.endDate) {
    throw new Error("[training-blocks.plan] Training block start date must be before end date.");
  }

  assertPlannedSessions(plan.sessions, plan.block.id, plan.revision.id, "training-blocks.plan");

  return plan;
};
