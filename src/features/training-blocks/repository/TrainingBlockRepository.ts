import { BaseRepository, type RepositoryContext } from "@/database/repository";
import { parseWithSchema } from "@/schema/parseWithSchema";

import { assertValidBenchmarkCollection } from "@/features/training-blocks/domain/invariants";
import {
  benchmarkInputSchema,
  benchmarkSchema,
  generatedTrainingPlanSchema,
  type Benchmark,
  type BenchmarkInput,
  type GeneratedTrainingPlan,
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

const makeId = (prefix: string): string => `${prefix}_${crypto.randomUUID()}`;

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

export class TrainingBlockRepository extends BaseRepository {
  constructor(context: RepositoryContext) {
    super(context);
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

  async persistGeneratedTrainingPlanAsync(
    input: GeneratedTrainingPlan,
    sourceBenchmarks: readonly Benchmark[],
  ): Promise<GeneratedTrainingPlan> {
    const plan = parseWithSchema(
      generatedTrainingPlanSchema,
      input,
      "training-blocks.persist-generated-plan",
    );
    const normalizedBenchmarks = sourceBenchmarks.map((benchmark) =>
      parseWithSchema(benchmarkSchema, benchmark, "training-blocks.persist-benchmark"),
    );

    await this.database.withExclusiveTransactionAsync(async (transaction) => {
      await transaction.runAsync(
        "INSERT INTO benchmark_snapshots (id, created_at) VALUES (?, ?)",
        plan.block.benchmarkSnapshotId,
        plan.block.createdAt,
      );

      for (const benchmark of normalizedBenchmarks) {
        await transaction.runAsync(
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
          benchmark.notes,
        );
      }

      await transaction.runAsync(
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

      await transaction.runAsync(
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
        await transaction.runAsync(
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
          await transaction.runAsync(
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
            await transaction.runAsync(
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
    });

    return plan;
  }
}
