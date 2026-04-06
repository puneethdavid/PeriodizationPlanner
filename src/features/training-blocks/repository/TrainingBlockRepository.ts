import { BaseRepository, type RepositoryContext } from "@/database/repository";
import { parseWithSchema } from "@/schema/parseWithSchema";
import type { SQLiteDatabase } from "expo-sqlite";

import { assertValidBenchmarkCollection } from "@/features/training-blocks/domain/invariants";
import {
  benchmarkInputSchema,
  benchmarkSchema,
  blockRevisionSchema,
  generatedTrainingPlanSchema,
  plannedExerciseSchema,
  plannedSessionSchema,
  plannedSetSchema,
  trainingBlockSchema,
  type Benchmark,
  type BenchmarkInput,
  type BlockRevision,
  type GeneratedTrainingPlan,
  type PlannedExercise,
  type PlannedSession,
  type PlannedSet,
  type TrainingBlock,
} from "@/features/training-blocks/schema/trainingBlockSchemas";
import {
  generateFixedTrainingBlock,
  type FixedBlockGeneratorOptions,
} from "@/features/training-blocks/services/fixedBlockGenerator";

type BenchmarkRow = {
  id: string;
  lift_slug: Benchmark["liftSlug"];
  benchmark_type: Benchmark["benchmarkType"];
  value: number;
  unit: Benchmark["unit"];
  captured_at: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

type TrainingBlockRow = {
  id: string;
  name: string;
  status: TrainingBlock["status"];
  goal_slug: string;
  start_date: string;
  end_date: string;
  benchmark_snapshot_id: string;
  generation_version: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

type BlockRevisionRow = {
  id: string;
  block_id: string;
  revision_number: number;
  reason: string;
  summary: string;
  created_at: string;
};

type PlannedSessionRow = {
  id: string;
  block_id: string;
  block_revision_id: string;
  scheduled_date: string;
  session_index: number;
  week_index: number;
  session_type: PlannedSession["sessionType"];
  title: string;
  status: PlannedSession["status"];
};

type PlannedExerciseRow = {
  id: string;
  session_id: string;
  lift_slug: PlannedExercise["liftSlug"];
  exercise_slug: string;
  exercise_name: string;
  exercise_order: number;
  prescription_kind: PlannedExercise["prescriptionKind"];
};

type PlannedSetRow = {
  id: string;
  planned_exercise_id: string;
  set_index: number;
  target_reps: number;
  target_load: number;
  target_rpe: number | null;
  rest_seconds: number | null;
  tempo: string | null;
  is_amrap: number;
};

const makeId = (prefix: string): string => {
  const timestamp = Date.now().toString(36);
  const randomPart = Math.floor(Math.random() * 1_000_000_000)
    .toString(36)
    .padStart(6, "0");

  return `${prefix}_${timestamp}_${randomPart}`;
};

const mapBenchmarkRow = (row: BenchmarkRow): Benchmark =>
  parseWithSchema(
    benchmarkSchema,
    {
      id: row.id,
      liftSlug: row.lift_slug,
      benchmarkType: row.benchmark_type,
      value: row.value,
      unit: row.unit,
      capturedAt: row.captured_at,
      notes: row.notes,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    },
    "training-blocks.benchmark-row",
  );

const mapTrainingBlockRow = (row: TrainingBlockRow): TrainingBlock =>
  parseWithSchema(
    trainingBlockSchema,
    {
      id: row.id,
      name: row.name,
      status: row.status,
      goalSlug: row.goal_slug,
      startDate: row.start_date,
      endDate: row.end_date,
      benchmarkSnapshotId: row.benchmark_snapshot_id,
      generationVersion: row.generation_version,
      notes: row.notes,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    },
    "training-blocks.block-row",
  );

const mapBlockRevisionRow = (row: BlockRevisionRow): BlockRevision =>
  parseWithSchema(
    blockRevisionSchema,
    {
      id: row.id,
      blockId: row.block_id,
      revisionNumber: row.revision_number,
      reason: row.reason,
      summary: row.summary,
      createdAt: row.created_at,
    },
    "training-blocks.block-revision-row",
  );

const mapPlannedSetRow = (row: PlannedSetRow): PlannedSet =>
  parseWithSchema(
    plannedSetSchema,
    {
      id: row.id,
      plannedExerciseId: row.planned_exercise_id,
      setIndex: row.set_index,
      targetReps: row.target_reps,
      targetLoad: row.target_load,
      targetRpe: row.target_rpe,
      restSeconds: row.rest_seconds,
      tempo: row.tempo,
      isAmrap: row.is_amrap === 1,
    },
    "training-blocks.planned-set-row",
  );

const mapPlannedExerciseRow = (
  row: PlannedExerciseRow,
  plannedSets: readonly PlannedSet[],
): PlannedExercise =>
  parseWithSchema(
    plannedExerciseSchema,
    {
      id: row.id,
      sessionId: row.session_id,
      liftSlug: row.lift_slug,
      exerciseSlug: row.exercise_slug,
      exerciseName: row.exercise_name,
      exerciseOrder: row.exercise_order,
      prescriptionKind: row.prescription_kind,
      plannedSets,
    },
    "training-blocks.planned-exercise-row",
  );

const mapPlannedSessionRow = (
  row: PlannedSessionRow,
  plannedExercises: readonly PlannedExercise[],
): PlannedSession =>
  parseWithSchema(
    plannedSessionSchema,
    {
      id: row.id,
      blockId: row.block_id,
      blockRevisionId: row.block_revision_id,
      scheduledDate: row.scheduled_date,
      sessionIndex: row.session_index,
      weekIndex: row.week_index,
      sessionType: row.session_type,
      title: row.title,
      status: row.status,
      plannedExercises,
    },
    "training-blocks.planned-session-row",
  );

export class TrainingBlockRepository extends BaseRepository {
  constructor(context: RepositoryContext) {
    super(context);
  }

  async resetTrainingBlockDataAsync(): Promise<void> {
    await this.database.withExclusiveTransactionAsync(async (transaction) => {
      await transaction.execAsync(`
        DELETE FROM explanation_records;
        DELETE FROM adaptation_events;
        DELETE FROM logged_set_results;
        DELETE FROM workout_results;
        DELETE FROM planned_sets;
        DELETE FROM planned_exercises;
        DELETE FROM planned_sessions;
        DELETE FROM block_revisions;
        DELETE FROM training_blocks;
        DELETE FROM benchmark_snapshot_items;
        DELETE FROM benchmark_snapshots;
        DELETE FROM benchmarks;
      `);
    });
  }

  private async persistGeneratedTrainingPlanWithDatabaseAsync(
    database: SQLiteDatabase,
    plan: GeneratedTrainingPlan,
    sourceBenchmarks: readonly Benchmark[],
  ): Promise<GeneratedTrainingPlan> {
    const normalizedBenchmarks = sourceBenchmarks.map((benchmark) =>
      parseWithSchema(benchmarkSchema, benchmark, "training-blocks.persist-benchmark"),
    );

    await database.runAsync("DELETE FROM training_blocks WHERE id = ?", plan.block.id);
    await database.runAsync(
      "DELETE FROM benchmark_snapshots WHERE id = ?",
      plan.block.benchmarkSnapshotId,
    );

    await database.runAsync(
      "INSERT INTO benchmark_snapshots (id, created_at) VALUES (?, ?)",
      plan.block.benchmarkSnapshotId,
      plan.block.createdAt,
    );

    for (const benchmark of normalizedBenchmarks) {
      await database.runAsync(
        `
          INSERT INTO benchmark_snapshot_items (
            id,
            snapshot_id,
            benchmark_id,
            lift_slug,
            benchmark_type,
            value,
            unit,
            captured_at,
            notes
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
        makeId("snapshot_item"),
        plan.block.benchmarkSnapshotId,
        benchmark.id,
        benchmark.liftSlug,
        benchmark.benchmarkType,
        benchmark.value,
        benchmark.unit,
        benchmark.capturedAt,
        benchmark.notes ?? null,
      );
    }

    await database.runAsync(
      `
        INSERT INTO training_blocks (
          id,
          name,
          status,
          goal_slug,
          start_date,
          end_date,
          benchmark_snapshot_id,
          generation_version,
          notes,
          created_at,
          updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      plan.block.id,
      plan.block.name,
      plan.block.status,
      plan.block.goalSlug,
      plan.block.startDate,
      plan.block.endDate,
      plan.block.benchmarkSnapshotId,
      plan.block.generationVersion,
      plan.block.notes ?? null,
      plan.block.createdAt,
      plan.block.updatedAt,
    );

    await database.runAsync(
      `
        INSERT INTO block_revisions (
          id,
          block_id,
          revision_number,
          reason,
          summary,
          created_at
        ) VALUES (?, ?, ?, ?, ?, ?)
      `,
      plan.revision.id,
      plan.revision.blockId,
      plan.revision.revisionNumber,
      plan.revision.reason,
      plan.revision.summary,
      plan.revision.createdAt,
    );

    for (const session of plan.sessions) {
      await database.runAsync(
        `
          INSERT INTO planned_sessions (
            id,
            block_id,
            block_revision_id,
            scheduled_date,
            session_index,
            week_index,
            session_type,
            title,
            status
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
        session.id,
        session.blockId,
        session.blockRevisionId,
        session.scheduledDate,
        session.sessionIndex,
        session.weekIndex,
        session.sessionType,
        session.title,
        session.status,
      );

      for (const exercise of session.plannedExercises) {
        await database.runAsync(
          `
            INSERT INTO planned_exercises (
              id,
              session_id,
              lift_slug,
              exercise_slug,
              exercise_name,
              exercise_order,
              prescription_kind
            ) VALUES (?, ?, ?, ?, ?, ?, ?)
          `,
          exercise.id,
          exercise.sessionId,
          exercise.liftSlug,
          exercise.exerciseSlug,
          exercise.exerciseName,
          exercise.exerciseOrder,
          exercise.prescriptionKind,
        );

        for (const plannedSet of exercise.plannedSets) {
          await database.runAsync(
            `
              INSERT INTO planned_sets (
                id,
                planned_exercise_id,
                set_index,
                target_reps,
                target_load,
                target_rpe,
                rest_seconds,
                tempo,
                is_amrap
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            `,
            plannedSet.id,
            plannedSet.plannedExerciseId,
            plannedSet.setIndex,
            plannedSet.targetReps,
            plannedSet.targetLoad,
            plannedSet.targetRpe,
            plannedSet.restSeconds,
            plannedSet.tempo,
            plannedSet.isAmrap ? 1 : 0,
          );
        }
      }
    }

    return plan;
  }

  async saveBenchmarksAsync(inputs: readonly BenchmarkInput[]): Promise<readonly Benchmark[]> {
    const normalizedBenchmarks = inputs.map((input) =>
      parseWithSchema(benchmarkInputSchema, input, "training-blocks.save-benchmark"),
    );
    const createdAt = new Date().toISOString();
    const benchmarks = normalizedBenchmarks.map((benchmark) => ({
      id: makeId("benchmark"),
      liftSlug: benchmark.liftSlug,
      benchmarkType: benchmark.benchmarkType,
      value: benchmark.value,
      unit: benchmark.unit,
      capturedAt: benchmark.capturedAt ?? createdAt,
      notes: benchmark.notes ?? null,
      createdAt,
      updatedAt: createdAt,
    }));

    assertValidBenchmarkCollection(benchmarks);

    await this.database.withExclusiveTransactionAsync(async (transaction) => {
      for (const benchmark of benchmarks) {
        const existingRow = await transaction.getFirstAsync<{ id: string }>(
          "SELECT id FROM benchmarks WHERE lift_slug = ?",
          benchmark.liftSlug,
        );

        await transaction.runAsync(
          `
            INSERT INTO benchmarks (
              id,
              lift_slug,
              benchmark_type,
              value,
              unit,
              captured_at,
              notes,
              created_at,
              updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(lift_slug) DO UPDATE SET
              benchmark_type = excluded.benchmark_type,
              value = excluded.value,
              unit = excluded.unit,
              captured_at = excluded.captured_at,
              notes = excluded.notes,
              updated_at = excluded.updated_at
          `,
          existingRow?.id ?? benchmark.id,
          benchmark.liftSlug,
          benchmark.benchmarkType,
          benchmark.value,
          benchmark.unit,
          benchmark.capturedAt,
          benchmark.notes ?? null,
          benchmark.createdAt,
          benchmark.updatedAt,
        );
      }
    });

    return this.getLatestBenchmarksAsync();
  }

  async getLatestBenchmarksAsync(): Promise<readonly Benchmark[]> {
    const rows = await this.database.getAllAsync<BenchmarkRow>(
      `
        SELECT
          id,
          lift_slug,
          benchmark_type,
          value,
          unit,
          captured_at,
          notes,
          created_at,
          updated_at
        FROM benchmarks
        ORDER BY lift_slug ASC
      `,
    );

    const benchmarks = rows.map((row) => mapBenchmarkRow(row));
    assertValidBenchmarkCollection(benchmarks);
    return benchmarks;
  }

  async createTrainingBlockFromSavedBenchmarksAsync(
    options: FixedBlockGeneratorOptions,
  ): Promise<GeneratedTrainingPlan> {
    const benchmarks = await this.getLatestBenchmarksAsync();

    if (benchmarks.length === 0) {
      throw new Error(
        "[training-blocks] Cannot generate a training block without saved benchmark inputs.",
      );
    }

    const plan = generateFixedTrainingBlock(benchmarks, options);
    return this.persistGeneratedTrainingPlanAsync(plan, benchmarks);
  }

  async createActiveTrainingBlockFromSavedBenchmarksAsync(
    options: FixedBlockGeneratorOptions,
  ): Promise<GeneratedTrainingPlan> {
    const benchmarks = await this.getLatestBenchmarksAsync();

    if (benchmarks.length === 0) {
      throw new Error(
        "[training-blocks] Cannot create an active training block without saved benchmark inputs.",
      );
    }

    const generatedPlan = generateFixedTrainingBlock(benchmarks, options);
    const activatedAt = new Date().toISOString();
    const activePlan = parseWithSchema(
      generatedTrainingPlanSchema,
      {
        ...generatedPlan,
        block: {
          ...generatedPlan.block,
          status: "active",
          updatedAt: activatedAt,
        },
      },
      "training-blocks.activate-generated-plan",
    );

    await this.database.withExclusiveTransactionAsync(async (transaction) => {
      await transaction.runAsync(
        `
          UPDATE training_blocks
          SET status = 'archived',
              updated_at = ?
          WHERE status = 'active'
        `,
        activatedAt,
      );

      await this.persistGeneratedTrainingPlanWithDatabaseAsync(
        transaction,
        activePlan,
        benchmarks,
      );
    });

    return activePlan;
  }

  async persistGeneratedTrainingPlanAsync(
    input: GeneratedTrainingPlan,
    sourceBenchmarks: readonly Benchmark[],
  ): Promise<GeneratedTrainingPlan> {
    const plan = parseWithSchema(
      generatedTrainingPlanSchema,
      input,
      "training-blocks.persist-generated-plan",
    );
    await this.database.withExclusiveTransactionAsync(async (transaction) => {
      await this.persistGeneratedTrainingPlanWithDatabaseAsync(transaction, plan, sourceBenchmarks);
    });

    return plan;
  }

  async getActiveTrainingBlockAsync(): Promise<GeneratedTrainingPlan | null> {
    const activeBlockRow = await this.database.getFirstAsync<TrainingBlockRow>(
      `
        SELECT
          id,
          name,
          status,
          goal_slug,
          start_date,
          end_date,
          benchmark_snapshot_id,
          generation_version,
          notes,
          created_at,
          updated_at
        FROM training_blocks
        WHERE status = 'active'
        ORDER BY updated_at DESC
        LIMIT 1
      `,
    );

    if (activeBlockRow === null) {
      return null;
    }

    const block = mapTrainingBlockRow(activeBlockRow);
    const revisionRow = await this.database.getFirstAsync<BlockRevisionRow>(
      `
        SELECT
          id,
          block_id,
          revision_number,
          reason,
          summary,
          created_at
        FROM block_revisions
        WHERE block_id = ?
        ORDER BY revision_number DESC
        LIMIT 1
      `,
      block.id,
    );

    if (revisionRow === null) {
      throw new Error(
        `[training-blocks] Active block ${block.id} is missing its persisted revision record.`,
      );
    }

    const revision = mapBlockRevisionRow(revisionRow);
    const sessionRows = await this.database.getAllAsync<PlannedSessionRow>(
      `
        SELECT
          id,
          block_id,
          block_revision_id,
          scheduled_date,
          session_index,
          week_index,
          session_type,
          title,
          status
        FROM planned_sessions
        WHERE block_revision_id = ?
        ORDER BY session_index ASC
      `,
      revision.id,
    );

    const sessions = await Promise.all(
      sessionRows.map(async (sessionRow) => {
        const exerciseRows = await this.database.getAllAsync<PlannedExerciseRow>(
          `
            SELECT
              id,
              session_id,
              lift_slug,
              exercise_slug,
              exercise_name,
              exercise_order,
              prescription_kind
            FROM planned_exercises
            WHERE session_id = ?
            ORDER BY exercise_order ASC
          `,
          sessionRow.id,
        );

        const plannedExercises = await Promise.all(
          exerciseRows.map(async (exerciseRow) => {
            const plannedSetRows = await this.database.getAllAsync<PlannedSetRow>(
              `
                SELECT
                  id,
                  planned_exercise_id,
                  set_index,
                  target_reps,
                  target_load,
                  target_rpe,
                  rest_seconds,
                  tempo,
                  is_amrap
                FROM planned_sets
                WHERE planned_exercise_id = ?
                ORDER BY set_index ASC
              `,
              exerciseRow.id,
            );

            return mapPlannedExerciseRow(
              exerciseRow,
              plannedSetRows.map((plannedSetRow) => mapPlannedSetRow(plannedSetRow)),
            );
          }),
        );

        return mapPlannedSessionRow(sessionRow, plannedExercises);
      }),
    );

    return parseWithSchema(
      generatedTrainingPlanSchema,
      {
        block,
        revision,
        sessions,
      },
      "training-blocks.active-plan",
    );
  }
}
