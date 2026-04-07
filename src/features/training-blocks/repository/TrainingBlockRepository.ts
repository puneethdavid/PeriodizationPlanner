import { BaseRepository, type RepositoryContext } from "@/database/repository";
import { parseWithSchema } from "@/schema/parseWithSchema";
import type { SQLiteDatabase } from "expo-sqlite";

import { assertValidBenchmarkCollection } from "@/features/training-blocks/domain/invariants";
import {
  benchmarkInputSchema,
  benchmarkSchema,
  blockRevisionSchema,
  blockSchedulingPreferencesSchema,
  generatedTrainingPlanSchema,
  loggedSetResultSchema,
  explanationRecordSchema,
  lpCheckpointResultSchema,
  lpGoalProgressSchema,
  lpLiftProgressionStateSchema,
  lpProgramStateSchema,
  plannedExerciseSchema,
  plannedSessionLpMetadataSchema,
  plannedSessionSchema,
  plannedSetSchema,
  trainingBlockSchema,
  workoutResultSchema,
  type Benchmark,
  type BenchmarkInput,
  type BlockConfiguration,
  type BlockSchedulingPreferences,
  type BlockRevision,
  type AdaptationEvent,
  type ExplanationRecord,
  type GeneratedTrainingPlan,
  type LoggedSetResult,
  type LiftGoal,
  type LpCheckpointResult,
  type LpGoalProgress,
  type LpLiftProgressionState,
  type LpProgramState,
  type PlannedExercise,
  type PlannedSession,
  type PlannedSessionLpMetadata,
  type PlannedSet,
  type TrainingBlock,
  type WorkoutResult,
} from "@/features/training-blocks/schema/trainingBlockSchemas";
import type {
  AdaptationPlanStore,
  AdaptationWorkoutReview,
  AdaptationTrigger,
  PersistedAdaptationRevision,
  ProposedPlanRevision,
} from "@/features/training-blocks/services/adaptationEngineContracts";
import {
  generateGoalDrivenLpTrainingBlock,
  type GoalDrivenLpGeneratorOptions,
} from "@/features/training-blocks/services/goalDrivenLpGenerator";
import {
  createDefaultBlockConfiguration,
  parseBlockConfigurationSnapshot,
  serializeBlockConfigurationSnapshot,
  validateBlockConfiguration,
} from "@/features/training-blocks/services/blockConfigurationService";
import { buildAdaptationExplanationArtifacts } from "@/features/training-blocks/services/adaptationExplanationBuilder";
import {
  createInitialLiftProgressionStates,
  createInitialLpProgramState,
} from "@/features/training-blocks/services/lpProgressionStateService";
import { deriveLpProgramLevel } from "@/features/training-blocks/services/linearPeriodizationProgramService";
import {
  parseSerializedTrainingWeekdays,
  serializeTrainingWeekdays,
  validateBlockSchedulingPreferences,
} from "@/features/training-blocks/services/blockSchedulingService";

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
  training_days_per_week: number | null;
  selected_training_weekdays: string | null;
  duration_weeks: number | null;
  primary_goal: LiftGoal | null;
  secondary_goal: LiftGoal | null;
  benchmark_lift_slugs: string | null;
  primary_lifts_per_session: number | null;
  secondary_lifts_per_session: number | null;
  primary_lift_pool: string | null;
  secondary_lift_pool: string | null;
  target_lift_goals: string | null;
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
  scheduled_weekday: PlannedSession["scheduledWeekday"];
  session_index: number;
  week_index: number;
  session_type: PlannedSession["sessionType"];
  title: string;
  status: PlannedSession["status"];
  lp_metadata: string | null;
};

type BlockSetupPreferencesRow = {
  id: string;
  training_days_per_week: number;
  selected_training_weekdays: string;
  duration_weeks: number | null;
  primary_goal: LiftGoal | null;
  secondary_goal: LiftGoal | null;
  benchmark_lift_slugs: string | null;
  primary_lifts_per_session: number | null;
  secondary_lifts_per_session: number | null;
  primary_lift_pool: string | null;
  secondary_lift_pool: string | null;
  target_lift_goals: string | null;
  updated_at: string;
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

type WorkoutHistoryRow = {
  session_id: string;
  session_title: string;
  scheduled_date: string;
  completion_status: "completed" | "partial" | "missed";
  completed_at: string;
  session_type: PlannedSession["sessionType"];
  exercise_count: number;
  planned_set_count: number;
  block_name: string;
  block_status: TrainingBlock["status"];
};

type WorkoutResultRow = {
  id: string;
  session_id: string;
  completed_at: string;
  completion_status: WorkoutResult["completionStatus"];
  notes: string | null;
  perceived_difficulty: number | null;
};

type LoggedSetResultRow = {
  id: string;
  workout_result_id: string;
  planned_set_id: string | null;
  set_index: number;
  actual_reps: number | null;
  actual_load: number | null;
  actual_rpe: number | null;
  is_completed: number;
};

type SessionCountRow = {
  total_sessions: number;
  completed_sessions: number;
  benchmark_sessions: number;
  final_test_sessions: number;
};

type AdaptationSummaryRow = {
  event_id: string;
  block_revision_id: string | null;
  triggered_at: string;
  event_type: "generation" | "progression-adjustment" | "deload-adjustment";
  reason_code: string;
  summary: string;
  event_headline: string | null;
  event_body: string | null;
  revision_headline: string | null;
  revision_body: string | null;
};

type LpProgramStateRow = {
  block_id: string;
  state_json: string;
  updated_at: string;
};

type LpLiftProgressionStateRow = {
  id: string;
  block_id: string;
  lift_slug: string;
  state_json: string;
  updated_at: string;
};

type LpCheckpointResultRow = {
  id: string;
  block_id: string;
  session_id: string;
  lift_slug: string;
  checkpoint_type: string;
  expected_load: number;
  actual_load: number;
  status: string;
  created_at: string;
};

type LpGoalProgressRow = {
  id: string;
  block_id: string;
  lift_slug: string;
  target_weight: number;
  target_test_type: string;
  expected_checkpoint_load: number | null;
  actual_checkpoint_load: number | null;
  status: string;
  remaining_delta: number;
  updated_at: string;
};

type LpMesocycleExtensionRow = {
  id: string;
  block_id: string;
  triggered_by_checkpoint_result_id: string | null;
  added_phase: string;
  added_weeks: number;
  reason: string;
  created_at: string;
};

export type ArchivedTrainingBlockSummary = {
  blockId: string;
  blockName: string;
  startDate: string;
  endDate: string;
  archivedAt: string;
  durationWeeks: number | null;
  completedSessions: number;
  totalSessions: number;
  benchmarkSessionCount: number;
  finalTestSessionCount: number;
  latestRevisionSummary: string | null;
};

export type WorkoutSessionReview = {
  block: Pick<TrainingBlock, "id" | "name" | "status" | "updatedAt">;
  session: PlannedSession;
  workoutResult: WorkoutResult | null;
  loggedSetResults: readonly LoggedSetResult[];
};

export type AdaptationSummary = {
  eventId: string;
  blockRevisionId: string | null;
  triggeredAt: string;
  eventType: "generation" | "progression-adjustment" | "deload-adjustment";
  reasonCode: string;
  summary: string;
  headline: string;
  body: string;
  revisionHeadline: string | null;
  revisionBody: string | null;
};

export type ActiveLpPlanReview = {
  programLevel: LpProgramState["programLevel"];
  currentPhase: LpProgramState["currentPhase"];
  nextCheckpointType: LpProgramState["nextCheckpointType"];
  activeDeloadUntilSessionIndex: number | null;
  goalProgress: readonly LpGoalProgress[];
  recentCheckpoints: readonly LpCheckpointResult[];
  mesocycleExtensions: readonly {
    id: string;
    addedPhase: string;
    addedWeeks: number;
    reason: string;
    createdAt: string;
  }[];
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
      blockConfiguration: parseBlockConfigurationSnapshot({
        durationWeeks: row.duration_weeks,
        primaryGoal: row.primary_goal,
        secondaryGoal: row.secondary_goal,
        benchmarkLiftSlugs: row.benchmark_lift_slugs,
        primaryLiftsPerSession: row.primary_lifts_per_session,
        secondaryLiftsPerSession: row.secondary_lifts_per_session,
        primaryLiftPool: row.primary_lift_pool,
        secondaryLiftPool: row.secondary_lift_pool,
        targetLiftGoals: row.target_lift_goals,
        trainingDaysPerWeek: row.training_days_per_week,
        selectedTrainingWeekdays: row.selected_training_weekdays,
      }),
      schedulingPreferences:
        row.training_days_per_week === null || row.selected_training_weekdays === null
          ? null
          : parseWithSchema(
              blockSchedulingPreferencesSchema,
              {
                trainingDaysPerWeek: row.training_days_per_week,
                selectedTrainingWeekdays: parseSerializedTrainingWeekdays(
                  row.selected_training_weekdays,
                ),
              },
              "training-blocks.block-scheduling-preferences-row",
            ),
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
      scheduledWeekday: row.scheduled_weekday,
      sessionIndex: row.session_index,
      weekIndex: row.week_index,
      sessionType: row.session_type,
      title: row.title,
      status: row.status,
      lpMetadata:
        row.lp_metadata === null
          ? null
          : parseWithSchema(
              plannedSessionLpMetadataSchema,
              JSON.parse(row.lp_metadata) as unknown,
              "training-blocks.planned-session-lp-metadata-row",
            ),
      plannedExercises,
    },
    "training-blocks.planned-session-row",
  );

const mapLpProgramStateRow = (row: LpProgramStateRow): LpProgramState =>
  parseWithSchema(
    lpProgramStateSchema,
    JSON.parse(row.state_json) as unknown,
    "training-blocks.lp-program-state-row",
  );

const mapLpLiftProgressionStateRow = (
  row: LpLiftProgressionStateRow,
): LpLiftProgressionState =>
  parseWithSchema(
    lpLiftProgressionStateSchema,
    JSON.parse(row.state_json) as unknown,
    "training-blocks.lp-lift-progression-state-row",
  );

const mapLpCheckpointResultRow = (row: LpCheckpointResultRow): LpCheckpointResult =>
  parseWithSchema(
    lpCheckpointResultSchema,
    {
      id: row.id,
      blockId: row.block_id,
      sessionId: row.session_id,
      liftSlug: row.lift_slug,
      checkpointType: row.checkpoint_type,
      expectedLoad: row.expected_load,
      actualLoad: row.actual_load,
      status: row.status,
      createdAt: row.created_at,
    },
    "training-blocks.lp-checkpoint-result-row",
  );

const mapLpGoalProgressRow = (row: LpGoalProgressRow): LpGoalProgress =>
  parseWithSchema(
    lpGoalProgressSchema,
    {
      id: row.id,
      blockId: row.block_id,
      liftSlug: row.lift_slug,
      targetWeight: row.target_weight,
      targetTestType: row.target_test_type,
      expectedCheckpointLoad: row.expected_checkpoint_load,
      actualCheckpointLoad: row.actual_checkpoint_load,
      status: row.status,
      remainingDelta: row.remaining_delta,
      updatedAt: row.updated_at,
    },
    "training-blocks.lp-goal-progress-row",
  );

const mapWorkoutResultRow = (row: WorkoutResultRow): WorkoutResult =>
  parseWithSchema(
    workoutResultSchema,
    {
      id: row.id,
      sessionId: row.session_id,
      completedAt: row.completed_at,
      completionStatus: row.completion_status,
      notes: row.notes,
      perceivedDifficulty: row.perceived_difficulty,
    },
    "training-blocks.workout-result-row",
  );

const mapLoggedSetResultRow = (row: LoggedSetResultRow): LoggedSetResult =>
  parseWithSchema(
    loggedSetResultSchema,
    {
      id: row.id,
      workoutResultId: row.workout_result_id,
      plannedSetId: row.planned_set_id,
      setIndex: row.set_index,
      actualReps: row.actual_reps,
      actualLoad: row.actual_load,
      actualRpe: row.actual_rpe,
      isCompleted: row.is_completed === 1,
    },
    "training-blocks.logged-set-result-row",
  );

const makeSqlPlaceholders = (count: number): string => Array.from({ length: count }, () => "?").join(", ");

export class TrainingBlockRepository extends BaseRepository implements AdaptationPlanStore {
  constructor(context: RepositoryContext) {
    super(context);
  }

  private async getPlannedExercisesForSessionAsync(
    database: SQLiteDatabase,
    sessionId: string,
  ): Promise<readonly PlannedExercise[]> {
    const exerciseRows = await database.getAllAsync<PlannedExerciseRow>(
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
      sessionId,
    );

    return Promise.all(
      exerciseRows.map(async (exerciseRow) => {
        const plannedSetRows = await database.getAllAsync<PlannedSetRow>(
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
  }

  async resetTrainingBlockDataAsync(): Promise<void> {
    await this.database.withExclusiveTransactionAsync(async (transaction) => {
      await transaction.execAsync(`
        DELETE FROM lp_mesocycle_extensions;
        DELETE FROM lp_goal_progress;
        DELETE FROM lp_checkpoint_results;
        DELETE FROM lp_lift_progression_states;
        DELETE FROM lp_program_states;
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
        DELETE FROM block_setup_preferences;
      `);
    });
  }

  async getBlockSchedulingPreferencesAsync(): Promise<BlockSchedulingPreferences | null> {
    const configuration = await this.getBlockConfigurationAsync();

    if (configuration === null) {
      return null;
    }

    return configuration.schedulingPreferences;
  }

  async getBlockConfigurationAsync(): Promise<BlockConfiguration | null> {
    const row = await this.database.getFirstAsync<BlockSetupPreferencesRow>(
      `
        SELECT
          id,
          training_days_per_week,
          selected_training_weekdays,
          duration_weeks,
          primary_goal,
          secondary_goal,
          benchmark_lift_slugs,
          primary_lifts_per_session,
          secondary_lifts_per_session,
          primary_lift_pool,
          secondary_lift_pool,
          target_lift_goals,
          updated_at
        FROM block_setup_preferences
        WHERE id = 'current'
        LIMIT 1
      `,
    );

    if (row === null) {
      return null;
    }

    const parsedConfiguration = parseBlockConfigurationSnapshot({
      durationWeeks: row.duration_weeks,
      primaryGoal: row.primary_goal,
      secondaryGoal: row.secondary_goal,
      benchmarkLiftSlugs: row.benchmark_lift_slugs,
      primaryLiftsPerSession: row.primary_lifts_per_session,
      secondaryLiftsPerSession: row.secondary_lifts_per_session,
      primaryLiftPool: row.primary_lift_pool,
      secondaryLiftPool: row.secondary_lift_pool,
      targetLiftGoals: row.target_lift_goals,
      trainingDaysPerWeek: row.training_days_per_week,
      selectedTrainingWeekdays: row.selected_training_weekdays,
    });

    if (parsedConfiguration !== null) {
      return parsedConfiguration;
    }

    const defaultConfiguration = createDefaultBlockConfiguration();

    if (row.training_days_per_week !== null && row.selected_training_weekdays !== null) {
      return {
        ...defaultConfiguration,
        schedulingPreferences: {
          trainingDaysPerWeek: row.training_days_per_week,
          selectedTrainingWeekdays: [
            ...parseSerializedTrainingWeekdays(row.selected_training_weekdays),
          ],
        },
      };
    }

    return defaultConfiguration;
  }

  async saveBlockSchedulingPreferencesAsync(
    input: BlockSchedulingPreferences,
  ): Promise<BlockSchedulingPreferences> {
    const existingConfiguration =
      (await this.getBlockConfigurationAsync()) ?? createDefaultBlockConfiguration();
    const nextConfiguration = validateBlockConfiguration({
      ...existingConfiguration,
      schedulingPreferences: validateBlockSchedulingPreferences(input),
    });

    await this.saveBlockConfigurationAsync(nextConfiguration);

    return nextConfiguration.schedulingPreferences;
  }

  async saveBlockConfigurationAsync(input: BlockConfiguration): Promise<BlockConfiguration> {
    const validatedConfiguration = validateBlockConfiguration(input);
    const serializedConfiguration = serializeBlockConfigurationSnapshot(validatedConfiguration);
    const updatedAt = new Date().toISOString();

    await this.database.runAsync(
      `
        INSERT INTO block_setup_preferences (
          id,
          training_days_per_week,
          selected_training_weekdays,
          duration_weeks,
          primary_goal,
          secondary_goal,
          benchmark_lift_slugs,
          primary_lifts_per_session,
          secondary_lifts_per_session,
          primary_lift_pool,
          secondary_lift_pool,
          target_lift_goals,
          updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          training_days_per_week = excluded.training_days_per_week,
          selected_training_weekdays = excluded.selected_training_weekdays,
          duration_weeks = excluded.duration_weeks,
          primary_goal = excluded.primary_goal,
          secondary_goal = excluded.secondary_goal,
          benchmark_lift_slugs = excluded.benchmark_lift_slugs,
          primary_lifts_per_session = excluded.primary_lifts_per_session,
          secondary_lifts_per_session = excluded.secondary_lifts_per_session,
          primary_lift_pool = excluded.primary_lift_pool,
          secondary_lift_pool = excluded.secondary_lift_pool,
          target_lift_goals = excluded.target_lift_goals,
          updated_at = excluded.updated_at
      `,
      "current",
      serializedConfiguration.trainingDaysPerWeek,
      serializedConfiguration.selectedTrainingWeekdays,
      serializedConfiguration.durationWeeks,
      serializedConfiguration.primaryGoal,
      serializedConfiguration.secondaryGoal,
      serializedConfiguration.benchmarkLiftSlugs,
      serializedConfiguration.primaryLiftsPerSession,
      serializedConfiguration.secondaryLiftsPerSession,
      serializedConfiguration.primaryLiftPool,
      serializedConfiguration.secondaryLiftPool,
      serializedConfiguration.targetLiftGoals,
      updatedAt,
    );

    return validatedConfiguration;
  }

  async getLpProgramStateAsync(blockId: string): Promise<LpProgramState | null> {
    const row = await this.database.getFirstAsync<LpProgramStateRow>(
      `
        SELECT
          block_id,
          state_json,
          updated_at
        FROM lp_program_states
        WHERE block_id = ?
        LIMIT 1
      `,
      blockId,
    );

    return row === null ? null : mapLpProgramStateRow(row);
  }

  async getLpLiftProgressionStatesAsync(
    blockId: string,
  ): Promise<readonly LpLiftProgressionState[]> {
    const rows = await this.database.getAllAsync<LpLiftProgressionStateRow>(
      `
        SELECT
          id,
          block_id,
          lift_slug,
          state_json,
          updated_at
        FROM lp_lift_progression_states
        WHERE block_id = ?
        ORDER BY lift_slug ASC
      `,
      blockId,
    );

    return rows.map((row) => mapLpLiftProgressionStateRow(row));
  }

  async getLpGoalProgressAsync(blockId: string): Promise<readonly LpGoalProgress[]> {
    const rows = await this.database.getAllAsync<LpGoalProgressRow>(
      `
        SELECT
          id,
          block_id,
          lift_slug,
          target_weight,
          target_test_type,
          expected_checkpoint_load,
          actual_checkpoint_load,
          status,
          remaining_delta,
          updated_at
        FROM lp_goal_progress
        WHERE block_id = ?
        ORDER BY lift_slug ASC
      `,
      blockId,
    );

    return rows.map((row) => mapLpGoalProgressRow(row));
  }

  async getLpCheckpointResultsAsync(blockId: string): Promise<readonly LpCheckpointResult[]> {
    const rows = await this.database.getAllAsync<LpCheckpointResultRow>(
      `
        SELECT
          id,
          block_id,
          session_id,
          lift_slug,
          checkpoint_type,
          expected_load,
          actual_load,
          status,
          created_at
        FROM lp_checkpoint_results
        WHERE block_id = ?
        ORDER BY created_at DESC, id DESC
      `,
      blockId,
    );

    return rows.map((row) => mapLpCheckpointResultRow(row));
  }

  private async persistInitialLpStateAsync(
    database: SQLiteDatabase,
    input: {
      blockId: string;
      plan: GeneratedTrainingPlan;
      sourceBenchmarks: readonly Benchmark[];
    },
  ): Promise<void> {
    const updatedAt = input.plan.block.updatedAt;
    const programState = createInitialLpProgramState({
      blockId: input.blockId,
      programLevel: deriveLpProgramLevel(input.sourceBenchmarks),
      updatedAt,
    });
    const liftStates = createInitialLiftProgressionStates({
      blockId: input.blockId,
      benchmarks: input.sourceBenchmarks,
      updatedAt,
    });
    const targetGoals = input.plan.block.blockConfiguration?.targetLiftGoals ?? [];

    await database.runAsync(
      `
        INSERT OR REPLACE INTO lp_program_states (
          block_id,
          state_json,
          updated_at
        ) VALUES (?, ?, ?)
      `,
      input.blockId,
      JSON.stringify(programState),
      updatedAt,
    );

    for (const liftState of liftStates) {
      await database.runAsync(
        `
          INSERT OR REPLACE INTO lp_lift_progression_states (
            id,
            block_id,
            lift_slug,
            state_json,
            updated_at
          ) VALUES (?, ?, ?, ?, ?)
        `,
        liftState.id,
        liftState.blockId,
        liftState.liftSlug,
        JSON.stringify(liftState),
        updatedAt,
      );
    }

    for (const goal of targetGoals) {
      const sourceBenchmark = input.sourceBenchmarks.find(
        (benchmark) => benchmark.liftSlug === goal.liftSlug,
      );
      const progress = parseWithSchema(
        lpGoalProgressSchema,
        {
          id: `lp_goal_${input.blockId}_${goal.liftSlug}`,
          blockId: input.blockId,
          liftSlug: goal.liftSlug,
          targetWeight: goal.targetWeight,
          targetTestType: goal.targetTestType,
          expectedCheckpointLoad: null,
          actualCheckpointLoad: null,
          status: "on-track",
          remainingDelta: Math.max(
            0,
            Number(
              (
                goal.targetWeight -
                (sourceBenchmark?.value ?? 0)
              ).toFixed(2),
            ),
          ),
          updatedAt,
        },
        "training-blocks.initial-lp-goal-progress",
      );

      await database.runAsync(
        `
          INSERT OR REPLACE INTO lp_goal_progress (
            id,
            block_id,
            lift_slug,
            target_weight,
            target_test_type,
            expected_checkpoint_load,
            actual_checkpoint_load,
            status,
            remaining_delta,
            updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
        progress.id,
        progress.blockId,
        progress.liftSlug,
        progress.targetWeight,
        progress.targetTestType,
        progress.expectedCheckpointLoad,
        progress.actualCheckpointLoad,
        progress.status,
        progress.remainingDelta,
        progress.updatedAt,
      );
    }
  }

  private async persistGeneratedTrainingPlanWithDatabaseAsync(
    database: SQLiteDatabase,
    plan: GeneratedTrainingPlan,
    sourceBenchmarks: readonly Benchmark[],
  ): Promise<GeneratedTrainingPlan> {
    const normalizedBenchmarks = sourceBenchmarks.map((benchmark) =>
      parseWithSchema(benchmarkSchema, benchmark, "training-blocks.persist-benchmark"),
    );
    const sessionIds = plan.sessions.map((session) => session.id);
    const exerciseIds = plan.sessions.flatMap((session) =>
      session.plannedExercises.map((exercise) => exercise.id),
    );
    const plannedSetIds = plan.sessions.flatMap((session) =>
      session.plannedExercises.flatMap((exercise) => exercise.plannedSets.map((plannedSet) => plannedSet.id)),
    );

    await this.deletePersistedPlanGraphAsync(database, {
      blockId: plan.block.id,
      benchmarkSnapshotId: plan.block.benchmarkSnapshotId,
      revisionId: plan.revision.id,
      sessionIds,
      exerciseIds,
      plannedSetIds,
    });

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
          training_days_per_week,
          selected_training_weekdays,
          duration_weeks,
          primary_goal,
          secondary_goal,
          benchmark_lift_slugs,
          primary_lifts_per_session,
          secondary_lifts_per_session,
          primary_lift_pool,
          secondary_lift_pool,
          target_lift_goals,
          created_at,
          updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      ...(function () {
        const serializedConfiguration =
          plan.block.blockConfiguration === null
            ? null
            : serializeBlockConfigurationSnapshot(plan.block.blockConfiguration);

        return [
      plan.block.id,
      plan.block.name,
      plan.block.status,
      plan.block.goalSlug,
      plan.block.startDate,
      plan.block.endDate,
      plan.block.benchmarkSnapshotId,
      plan.block.generationVersion,
      plan.block.notes ?? null,
      plan.block.schedulingPreferences?.trainingDaysPerWeek ??
        plan.block.blockConfiguration?.schedulingPreferences.trainingDaysPerWeek ??
        null,
      plan.block.schedulingPreferences === null && plan.block.blockConfiguration === null
        ? null
        : serializeTrainingWeekdays(
            (
              plan.block.blockConfiguration?.schedulingPreferences ??
              plan.block.schedulingPreferences
            )!.selectedTrainingWeekdays,
          ),
      serializedConfiguration?.durationWeeks ?? null,
      serializedConfiguration?.primaryGoal ?? null,
      serializedConfiguration?.secondaryGoal ?? null,
      serializedConfiguration?.benchmarkLiftSlugs ?? null,
      serializedConfiguration?.primaryLiftsPerSession ?? null,
      serializedConfiguration?.secondaryLiftsPerSession ?? null,
      serializedConfiguration?.primaryLiftPool ?? null,
      serializedConfiguration?.secondaryLiftPool ?? null,
      serializedConfiguration?.targetLiftGoals ?? null,
      plan.block.createdAt,
      plan.block.updatedAt,
        ];
      })(),
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
          scheduled_weekday,
          session_index,
          week_index,
          session_type,
          title,
          status,
          lp_metadata
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
        session.id,
        session.blockId,
        session.blockRevisionId,
        session.scheduledDate,
        session.scheduledWeekday,
        session.sessionIndex,
        session.weekIndex,
        session.sessionType,
        session.title,
        session.status,
        session.lpMetadata === null ? null : JSON.stringify(session.lpMetadata),
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

    await this.persistInitialLpStateAsync(database, {
      blockId: plan.block.id,
      plan,
      sourceBenchmarks,
    });

    return plan;
  }

  private async deletePersistedPlanGraphAsync(
    database: SQLiteDatabase,
    input: {
      blockId: string;
      benchmarkSnapshotId: string;
      revisionId: string;
      sessionIds: readonly string[];
      exerciseIds: readonly string[];
      plannedSetIds: readonly string[];
    },
  ): Promise<void> {
    if (input.plannedSetIds.length > 0) {
      const placeholders = makeSqlPlaceholders(input.plannedSetIds.length);
      await database.runAsync(
        `DELETE FROM logged_set_results WHERE planned_set_id IN (${placeholders})`,
        ...input.plannedSetIds,
      );
    }

    if (input.sessionIds.length > 0) {
      const placeholders = makeSqlPlaceholders(input.sessionIds.length);
      await database.runAsync(
        `DELETE FROM workout_results WHERE session_id IN (${placeholders})`,
        ...input.sessionIds,
      );
      await database.runAsync(
        `DELETE FROM planned_sessions WHERE id IN (${placeholders})`,
        ...input.sessionIds,
      );
    }

    if (input.exerciseIds.length > 0) {
      const placeholders = makeSqlPlaceholders(input.exerciseIds.length);
      await database.runAsync(
        `DELETE FROM planned_exercises WHERE id IN (${placeholders})`,
        ...input.exerciseIds,
      );
    }

    if (input.plannedSetIds.length > 0) {
      const placeholders = makeSqlPlaceholders(input.plannedSetIds.length);
      await database.runAsync(
        `DELETE FROM planned_sets WHERE id IN (${placeholders})`,
        ...input.plannedSetIds,
      );
    }

    await database.runAsync("DELETE FROM block_revisions WHERE id = ?", input.revisionId);
    await database.runAsync("DELETE FROM lp_mesocycle_extensions WHERE block_id = ?", input.blockId);
    await database.runAsync("DELETE FROM lp_goal_progress WHERE block_id = ?", input.blockId);
    await database.runAsync("DELETE FROM lp_checkpoint_results WHERE block_id = ?", input.blockId);
    await database.runAsync("DELETE FROM lp_lift_progression_states WHERE block_id = ?", input.blockId);
    await database.runAsync("DELETE FROM lp_program_states WHERE block_id = ?", input.blockId);
    await database.runAsync("DELETE FROM training_blocks WHERE id = ?", input.blockId);
    await database.runAsync(
      "DELETE FROM benchmark_snapshot_items WHERE snapshot_id = ?",
      input.benchmarkSnapshotId,
    );
    await database.runAsync(
      "DELETE FROM benchmark_snapshots WHERE id = ?",
      input.benchmarkSnapshotId,
    );
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
    options: GoalDrivenLpGeneratorOptions,
  ): Promise<GeneratedTrainingPlan> {
    const benchmarks = await this.getLatestBenchmarksAsync();
    const blockConfiguration = await this.getRequiredBlockConfigurationAsync();

    if (benchmarks.length === 0) {
      throw new Error(
        "[training-blocks] Cannot generate a training block without saved benchmark inputs.",
      );
    }

    const plan = generateGoalDrivenLpTrainingBlock(benchmarks, {
      ...options,
      blockConfiguration,
    });
    return this.persistGeneratedTrainingPlanAsync(plan, benchmarks);
  }

  async createActiveTrainingBlockFromSavedBenchmarksAsync(
    options: GoalDrivenLpGeneratorOptions,
  ): Promise<GeneratedTrainingPlan> {
    const benchmarks = await this.getLatestBenchmarksAsync();
    const blockConfiguration = await this.getRequiredBlockConfigurationAsync();

    if (benchmarks.length === 0) {
      throw new Error(
        "[training-blocks] Cannot create an active training block without saved benchmark inputs.",
      );
    }

    const generatedPlan = generateGoalDrivenLpTrainingBlock(benchmarks, {
      ...options,
      blockConfiguration,
    });
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

  private async getRequiredBlockConfigurationAsync(): Promise<BlockConfiguration> {
    const blockConfiguration = await this.getBlockConfigurationAsync();

    if (blockConfiguration === null) {
      throw new Error(
        "[training-blocks] Save a valid block configuration before generating an active block.",
      );
    }

    return validateBlockConfiguration(blockConfiguration);
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
          training_days_per_week,
          selected_training_weekdays,
          duration_weeks,
          primary_goal,
          secondary_goal,
          benchmark_lift_slugs,
          primary_lifts_per_session,
          secondary_lifts_per_session,
          primary_lift_pool,
          secondary_lift_pool,
          target_lift_goals,
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
          scheduled_weekday,
          session_index,
          week_index,
          session_type,
          title,
          status,
          lp_metadata
        FROM planned_sessions
        WHERE block_id = ?
        ORDER BY session_index ASC
      `,
      block.id,
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

  async getActivePlanSnapshotAsync(): Promise<{
    plan: GeneratedTrainingPlan;
    completedSessions: readonly PlannedSession[];
    completedWorkoutReviews: readonly AdaptationWorkoutReview[];
    futureSessions: readonly PlannedSession[];
  } | null> {
    const plan = await this.getActiveTrainingBlockAsync();

    if (plan === null) {
      return null;
    }

    const completedSessions = plan.sessions.filter((session) => session.status !== "planned");
    const futureSessions = plan.sessions.filter((session) => session.status === "planned");
    const completedWorkoutReviews: readonly AdaptationWorkoutReview[] = (
      await Promise.all(
        completedSessions.map((session) => this.getWorkoutSessionReviewAsync(session.id)),
      )
    ).flatMap((review) => {
      if (review === null || review.workoutResult === null) {
        return [];
      }

      return [
        {
          session: review.session,
          workoutResult: review.workoutResult,
          loggedSetResults: review.loggedSetResults,
        },
      ];
    });

    return {
      plan,
      completedSessions,
      completedWorkoutReviews,
      futureSessions,
    };
  }

  async getLatestBlockRevisionAsync(blockId: string): Promise<BlockRevision | null> {
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
      blockId,
    );

    if (revisionRow === null) {
      return null;
    }

    return mapBlockRevisionRow(revisionRow);
  }

  async getPlannedSessionDetailAsync(sessionId: string): Promise<PlannedSession | null> {
    const sessionRow = await this.database.getFirstAsync<PlannedSessionRow>(
      `
        SELECT
          id,
          block_id,
          block_revision_id,
          scheduled_date,
          scheduled_weekday,
          session_index,
          week_index,
          session_type,
          title,
          status,
          lp_metadata
        FROM planned_sessions
        WHERE id = ?
        LIMIT 1
      `,
      sessionId,
    );

    if (sessionRow === null) {
      return null;
    }

    const plannedExercises = await this.getPlannedExercisesForSessionAsync(this.database, sessionId);

    return mapPlannedSessionRow(sessionRow, plannedExercises);
  }

  async getWorkoutSessionReviewAsync(sessionId: string): Promise<WorkoutSessionReview | null> {
    const sessionRow = await this.database.getFirstAsync<PlannedSessionRow>(
      `
        SELECT
          id,
          block_id,
          block_revision_id,
          scheduled_date,
          scheduled_weekday,
          session_index,
          week_index,
          session_type,
          title,
          status,
          lp_metadata
        FROM planned_sessions
        WHERE id = ?
        LIMIT 1
      `,
      sessionId,
    );

    if (sessionRow === null) {
      return null;
    }

    const [blockRow, workoutResultRow, plannedExercises] = await Promise.all([
      this.database.getFirstAsync<TrainingBlockRow>(
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
            training_days_per_week,
            selected_training_weekdays,
            duration_weeks,
            primary_goal,
            secondary_goal,
            benchmark_lift_slugs,
            primary_lifts_per_session,
            secondary_lifts_per_session,
            primary_lift_pool,
            secondary_lift_pool,
            target_lift_goals,
            created_at,
            updated_at
          FROM training_blocks
          WHERE id = ?
          LIMIT 1
        `,
        sessionRow.block_id,
      ),
      this.database.getFirstAsync<WorkoutResultRow>(
        `
          SELECT
            id,
            session_id,
            completed_at,
            completion_status,
            notes,
            perceived_difficulty
          FROM workout_results
          WHERE session_id = ?
          LIMIT 1
        `,
        sessionId,
      ),
      this.getPlannedExercisesForSessionAsync(this.database, sessionId),
    ]);

    if (blockRow === null) {
      throw new Error(
        `[training-blocks] Planned session ${sessionId} is missing its owning block record.`,
      );
    }

    const workoutResult = workoutResultRow === null ? null : mapWorkoutResultRow(workoutResultRow);
    const loggedSetResults =
      workoutResult === null
        ? []
        : (
            await this.database.getAllAsync<LoggedSetResultRow>(
              `
                SELECT
                  id,
                  workout_result_id,
                  planned_set_id,
                  set_index,
                  actual_reps,
                  actual_load,
                  actual_rpe,
                  is_completed
                FROM logged_set_results
                WHERE workout_result_id = ?
                ORDER BY set_index ASC
              `,
              workoutResult.id,
            )
          ).map((row) => mapLoggedSetResultRow(row));

    return {
      block: {
        id: blockRow.id,
        name: blockRow.name,
        status: blockRow.status,
        updatedAt: blockRow.updated_at,
      },
      session: mapPlannedSessionRow(sessionRow, plannedExercises),
      workoutResult,
      loggedSetResults,
    };
  }

  async getAdaptationTriggerAsync(sessionId: string): Promise<AdaptationTrigger | null> {
    const sessionReview = await this.getWorkoutSessionReviewAsync(sessionId);

    if (sessionReview === null || sessionReview.workoutResult === null) {
      return null;
    }

    return {
      sessionId,
      completedSession: sessionReview.session,
      workoutResult: sessionReview.workoutResult,
      loggedSetResults: sessionReview.loggedSetResults,
    };
  }

  async persistAdaptationRevisionAsync(
    proposedRevision: ProposedPlanRevision,
    updatedFutureSessions: readonly PlannedSession[],
  ): Promise<PersistedAdaptationRevision> {
    const createdAt = new Date().toISOString();
    const persistedRevision = parseWithSchema(
      blockRevisionSchema,
      {
        id: makeId("revision"),
        blockId: proposedRevision.blockId,
        revisionNumber: proposedRevision.nextRevisionNumber,
        reason: proposedRevision.reason,
        summary: proposedRevision.summary,
        createdAt,
      },
      "training-blocks.persist-adaptation-revision",
    );
    const normalizedSessions = updatedFutureSessions.map((session) =>
      parseWithSchema(
        plannedSessionSchema,
        {
          ...session,
          blockRevisionId: persistedRevision.id,
        },
        "training-blocks.persist-adaptation-session",
      ),
    );
    const { adaptationEvents, explanationRecords } = buildAdaptationExplanationArtifacts({
      proposedRevision,
      persistedRevision,
      createdAt,
      makeId,
    });

    await this.database.withExclusiveTransactionAsync(async (transaction) => {
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
        persistedRevision.id,
        persistedRevision.blockId,
        persistedRevision.revisionNumber,
        persistedRevision.reason,
        persistedRevision.summary,
        persistedRevision.createdAt,
      );

      for (const session of normalizedSessions) {
        await transaction.runAsync(
          `
            UPDATE planned_sessions
            SET block_revision_id = ?,
                scheduled_date = ?,
                scheduled_weekday = ?,
                title = ?,
                session_type = ?,
                status = ?,
                lp_metadata = ?
            WHERE id = ?
          `,
          session.blockRevisionId,
          session.scheduledDate,
          session.scheduledWeekday,
          session.title,
          session.sessionType,
          session.status,
          session.lpMetadata === null ? null : JSON.stringify(session.lpMetadata),
          session.id,
        );

        for (const exercise of session.plannedExercises) {
          await transaction.runAsync(
            `
              UPDATE planned_exercises
              SET lift_slug = ?,
                  exercise_slug = ?,
                  exercise_name = ?,
                  exercise_order = ?,
                  prescription_kind = ?
              WHERE id = ?
            `,
            exercise.liftSlug,
            exercise.exerciseSlug,
            exercise.exerciseName,
            exercise.exerciseOrder,
            exercise.prescriptionKind,
            exercise.id,
          );

          for (const plannedSet of exercise.plannedSets) {
            await transaction.runAsync(
              `
                UPDATE planned_sets
                SET target_reps = ?,
                    target_load = ?,
                    target_rpe = ?,
                    rest_seconds = ?,
                    tempo = ?,
                    is_amrap = ?
                WHERE id = ?
              `,
              plannedSet.targetReps,
              plannedSet.targetLoad,
              plannedSet.targetRpe,
              plannedSet.restSeconds,
              plannedSet.tempo,
              plannedSet.isAmrap ? 1 : 0,
              plannedSet.id,
            );
          }
        }
      }

      for (const adaptationEvent of adaptationEvents) {
        await transaction.runAsync(
          `
            INSERT INTO adaptation_events (
              id,
              block_id,
              block_revision_id,
              triggered_at,
              event_type,
              reason_code,
              summary
            ) VALUES (?, ?, ?, ?, ?, ?, ?)
          `,
          adaptationEvent.id,
          adaptationEvent.blockId,
          adaptationEvent.blockRevisionId,
          adaptationEvent.triggeredAt,
          adaptationEvent.eventType,
          adaptationEvent.reasonCode,
          adaptationEvent.summary,
        );
      }

      for (const explanationRecord of explanationRecords) {
        await transaction.runAsync(
          `
            INSERT INTO explanation_records (
              id,
              owner_type,
              owner_id,
              created_at,
              headline,
              body
            ) VALUES (?, ?, ?, ?, ?, ?)
          `,
          explanationRecord.id,
          explanationRecord.ownerType,
          explanationRecord.ownerId,
          explanationRecord.createdAt,
          explanationRecord.headline,
          explanationRecord.body,
        );
      }
    });

    return {
      revision: persistedRevision,
      updatedFutureSessions: normalizedSessions,
      adaptationEvents,
      explanationRecords,
    };
  }

  async persistLinearPeriodizationRevisionAsync(input: {
    blockId: string;
    triggeringSessionId: string;
    revisionReason: string;
    revisionSummary: string;
    updatedFutureSessions: readonly PlannedSession[];
    programState: LpProgramState;
    liftStates: readonly LpLiftProgressionState[];
    checkpointResults: readonly LpCheckpointResult[];
    goalProgress: readonly LpGoalProgress[];
    mesocycleExtensions: readonly {
      id: string;
      blockId: string;
      triggeredByCheckpointResultId: string | null;
      addedPhase: string;
      addedWeeks: number;
      reason: string;
      createdAt: string;
    }[];
    adaptationEvents: readonly AdaptationEvent[];
    explanationRecords: readonly ExplanationRecord[];
  }): Promise<void> {
    const createdAt = new Date().toISOString();
    const [latestRevision, triggeringSessionRow] = await Promise.all([
      this.getLatestBlockRevisionAsync(input.blockId),
      this.database.getFirstAsync<PlannedSessionRow>(
        `
          SELECT
            id,
            block_id,
            block_revision_id,
            scheduled_date,
            scheduled_weekday,
            session_index,
            week_index,
            session_type,
            title,
            status,
            lp_metadata
          FROM planned_sessions
          WHERE id = ?
          LIMIT 1
        `,
        input.triggeringSessionId,
      ),
    ]);

    if (latestRevision === null || triggeringSessionRow === null) {
      throw new Error(`[training-blocks] Missing latest revision for block ${input.blockId}.`);
    }

    const nextRevision = parseWithSchema(
      blockRevisionSchema,
      {
        id: makeId("revision"),
        blockId: input.blockId,
        revisionNumber: latestRevision.revisionNumber + 1,
        reason: input.revisionReason,
        summary: input.revisionSummary,
        createdAt,
      },
      "training-blocks.persist-linear-periodization-revision",
    );

    const normalizedFutureSessions = input.updatedFutureSessions.map((session, index) =>
      parseWithSchema(
        plannedSessionSchema,
        {
          ...session,
          id: makeId("session"),
          blockId: input.blockId,
          blockRevisionId: nextRevision.id,
          sessionIndex: triggeringSessionRow.session_index + index + 1,
          weekIndex: triggeringSessionRow.week_index + session.weekIndex - 1,
        },
        "training-blocks.persist-linear-periodization-session",
      ),
    );

    await this.database.withExclusiveTransactionAsync(async (transaction) => {
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
        nextRevision.id,
        nextRevision.blockId,
        nextRevision.revisionNumber,
        nextRevision.reason,
        nextRevision.summary,
        nextRevision.createdAt,
      );

      await transaction.runAsync(
        `
          DELETE FROM planned_sessions
          WHERE block_id = ?
            AND status = 'planned'
        `,
        input.blockId,
      );

      for (const session of normalizedFutureSessions) {
        await transaction.runAsync(
          `
            INSERT INTO planned_sessions (
              id,
              block_id,
              block_revision_id,
              scheduled_date,
              scheduled_weekday,
              session_index,
              week_index,
              session_type,
              title,
              status,
              lp_metadata
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `,
          session.id,
          session.blockId,
          session.blockRevisionId,
          session.scheduledDate,
          session.scheduledWeekday,
          session.sessionIndex,
          session.weekIndex,
          session.sessionType,
          session.title,
          session.status,
          session.lpMetadata === null ? null : JSON.stringify(session.lpMetadata),
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
            session.id,
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
              exercise.id,
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

      await transaction.runAsync(
        `
          INSERT OR REPLACE INTO lp_program_states (
            block_id,
            state_json,
            updated_at
          ) VALUES (?, ?, ?)
        `,
        input.programState.blockId,
        JSON.stringify(input.programState),
        input.programState.updatedAt,
      );

      await transaction.runAsync(`DELETE FROM lp_lift_progression_states WHERE block_id = ?`, input.blockId);
      for (const liftState of input.liftStates) {
        await transaction.runAsync(
          `
            INSERT INTO lp_lift_progression_states (
              id,
              block_id,
              lift_slug,
              state_json,
              updated_at
            ) VALUES (?, ?, ?, ?, ?)
          `,
          liftState.id,
          liftState.blockId,
          liftState.liftSlug,
          JSON.stringify(liftState),
          liftState.updatedAt,
        );
      }

      for (const checkpointResult of input.checkpointResults) {
        await transaction.runAsync(
          `
            INSERT INTO lp_checkpoint_results (
              id,
              block_id,
              session_id,
              lift_slug,
              checkpoint_type,
              expected_load,
              actual_load,
              status,
              created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
          `,
          checkpointResult.id,
          checkpointResult.blockId,
          checkpointResult.sessionId,
          checkpointResult.liftSlug,
          checkpointResult.checkpointType,
          checkpointResult.expectedLoad,
          checkpointResult.actualLoad,
          checkpointResult.status,
          checkpointResult.createdAt,
        );
      }

      for (const goalProgress of input.goalProgress) {
        await transaction.runAsync(
          `
            INSERT OR REPLACE INTO lp_goal_progress (
              id,
              block_id,
              lift_slug,
              target_weight,
              target_test_type,
              expected_checkpoint_load,
              actual_checkpoint_load,
              status,
              remaining_delta,
              updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `,
          goalProgress.id,
          goalProgress.blockId,
          goalProgress.liftSlug,
          goalProgress.targetWeight,
          goalProgress.targetTestType,
          goalProgress.expectedCheckpointLoad,
          goalProgress.actualCheckpointLoad,
          goalProgress.status,
          goalProgress.remainingDelta,
          goalProgress.updatedAt,
        );
      }

      for (const extension of input.mesocycleExtensions) {
        await transaction.runAsync(
          `
            INSERT INTO lp_mesocycle_extensions (
              id,
              block_id,
              triggered_by_checkpoint_result_id,
              added_phase,
              added_weeks,
              reason,
              created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?)
          `,
          extension.id,
          extension.blockId,
          extension.triggeredByCheckpointResultId,
          extension.addedPhase,
          extension.addedWeeks,
          extension.reason,
          extension.createdAt,
        );
      }

      for (const adaptationEvent of input.adaptationEvents) {
        await transaction.runAsync(
          `
            INSERT INTO adaptation_events (
              id,
              block_id,
              block_revision_id,
              triggered_at,
              event_type,
              reason_code,
              summary
            ) VALUES (?, ?, ?, ?, ?, ?, ?)
          `,
          adaptationEvent.id,
          adaptationEvent.blockId,
          nextRevision.id,
          adaptationEvent.triggeredAt,
          adaptationEvent.eventType,
          adaptationEvent.reasonCode,
          adaptationEvent.summary,
        );
      }

      for (const explanationRecord of input.explanationRecords) {
        await transaction.runAsync(
          `
            INSERT INTO explanation_records (
              id,
              owner_type,
              owner_id,
              created_at,
              headline,
              body
            ) VALUES (?, ?, ?, ?, ?, ?)
          `,
          explanationRecord.id,
          explanationRecord.ownerType,
          explanationRecord.ownerId,
          explanationRecord.createdAt,
          explanationRecord.headline,
          explanationRecord.body,
        );
      }
    });
  }

  async completeSessionAsPlannedAsync(sessionId: string): Promise<void> {
    const session = await this.getPlannedSessionDetailAsync(sessionId);

    if (session === null) {
      throw new Error(`[training-blocks] Planned session ${sessionId} was not found.`);
    }

    if (session.status === "completed") {
      return;
    }

    const completedAt = new Date().toISOString();
    const workoutResultId = makeId("workout_result");

    await this.database.withExclusiveTransactionAsync(async (transaction) => {
      await transaction.runAsync(
        `
          UPDATE planned_sessions
          SET status = 'completed'
          WHERE id = ?
        `,
        sessionId,
      );

      await transaction.runAsync(
        `
          INSERT OR REPLACE INTO workout_results (
            id,
            session_id,
            completed_at,
            completion_status,
            notes,
            perceived_difficulty
          ) VALUES (?, ?, ?, ?, ?, ?)
        `,
        workoutResultId,
        sessionId,
        completedAt,
        "completed",
        "Completed as planned through the quick completion flow.",
        null,
      );

      for (const exercise of session.plannedExercises) {
        for (const plannedSet of exercise.plannedSets) {
          await transaction.runAsync(
            `
              INSERT OR REPLACE INTO logged_set_results (
                id,
                workout_result_id,
                planned_set_id,
                set_index,
                actual_reps,
                actual_load,
                actual_rpe,
                is_completed
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            `,
            makeId("logged_set_result"),
            workoutResultId,
            plannedSet.id,
            plannedSet.setIndex,
            plannedSet.targetReps,
            plannedSet.targetLoad,
            plannedSet.targetRpe,
            1,
          );
        }
      }
    });
  }

  async saveAdjustedSessionResultsAsync(input: {
    sessionId: string;
    completionStatus: "completed" | "partial" | "missed";
    setResults: readonly {
      plannedSetId: string;
      setIndex: number;
      actualReps: number | null;
      actualLoad: number | null;
      actualRpe: number | null;
      isCompleted: boolean;
    }[];
  }): Promise<void> {
    const session = await this.getPlannedSessionDetailAsync(input.sessionId);

    if (session === null) {
      throw new Error(`[training-blocks] Planned session ${input.sessionId} was not found.`);
    }

    const completedAt = new Date().toISOString();
    const workoutResultId = makeId("workout_result");

    await this.database.withExclusiveTransactionAsync(async (transaction) => {
      await transaction.runAsync(
        `
          UPDATE planned_sessions
          SET status = ?
          WHERE id = ?
        `,
        input.completionStatus === "missed" ? "skipped" : "completed",
        input.sessionId,
      );

      await transaction.runAsync(
        `
          INSERT OR REPLACE INTO workout_results (
            id,
            session_id,
            completed_at,
            completion_status,
            notes,
            perceived_difficulty
          ) VALUES (?, ?, ?, ?, ?, ?)
        `,
        workoutResultId,
        input.sessionId,
        completedAt,
        input.completionStatus,
        "Saved through adjusted result entry.",
        null,
      );

      for (const setResult of input.setResults) {
        await transaction.runAsync(
          `
            INSERT OR REPLACE INTO logged_set_results (
              id,
              workout_result_id,
              planned_set_id,
              set_index,
              actual_reps,
              actual_load,
              actual_rpe,
              is_completed
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
          `,
          makeId("logged_set_result"),
          workoutResultId,
          setResult.plannedSetId,
          setResult.setIndex,
          setResult.actualReps,
          setResult.actualLoad,
          setResult.actualRpe,
          setResult.isCompleted ? 1 : 0,
        );
      }
    });
  }

  async getCompletedSessionHistoryAsync(): Promise<
    readonly {
      sessionId: string;
      title: string;
      scheduledDate: string;
      completedAt: string;
      completionStatus: "completed" | "partial" | "missed";
      sessionType: PlannedSession["sessionType"];
      exerciseCount: number;
      plannedSetCount: number;
      blockName: string;
      blockStatus: TrainingBlock["status"];
    }[]
  > {
    const rows = await this.database.getAllAsync<WorkoutHistoryRow>(
      `
        SELECT
          workout_results.session_id AS session_id,
          planned_sessions.title AS session_title,
          planned_sessions.scheduled_date AS scheduled_date,
          workout_results.completion_status AS completion_status,
          workout_results.completed_at AS completed_at,
          planned_sessions.session_type AS session_type,
          COUNT(DISTINCT planned_exercises.id) AS exercise_count,
          COUNT(DISTINCT planned_sets.id) AS planned_set_count,
          training_blocks.name AS block_name,
          training_blocks.status AS block_status
        FROM workout_results
        INNER JOIN planned_sessions
          ON planned_sessions.id = workout_results.session_id
        INNER JOIN training_blocks
          ON training_blocks.id = planned_sessions.block_id
        LEFT JOIN planned_exercises
          ON planned_exercises.session_id = planned_sessions.id
        LEFT JOIN planned_sets
          ON planned_sets.planned_exercise_id = planned_exercises.id
        GROUP BY
          workout_results.session_id,
          planned_sessions.title,
          planned_sessions.scheduled_date,
          workout_results.completion_status,
          workout_results.completed_at,
          planned_sessions.session_type,
          training_blocks.name,
          training_blocks.status
        ORDER BY workout_results.completed_at DESC
      `,
    );

    return rows.map((row) => ({
      sessionId: row.session_id,
      title: row.session_title,
      scheduledDate: row.scheduled_date,
      completedAt: row.completed_at,
      completionStatus: row.completion_status,
      sessionType: row.session_type,
      exerciseCount: row.exercise_count,
      plannedSetCount: row.planned_set_count,
      blockName: row.block_name,
      blockStatus: row.block_status,
    }));
  }

  async getArchivedTrainingBlockSummariesAsync(): Promise<
    readonly ArchivedTrainingBlockSummary[]
  > {
    const archivedBlockRows = await this.database.getAllAsync<TrainingBlockRow>(
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
          training_days_per_week,
          selected_training_weekdays,
          duration_weeks,
          primary_goal,
          secondary_goal,
          benchmark_lift_slugs,
          primary_lifts_per_session,
          secondary_lifts_per_session,
          primary_lift_pool,
          secondary_lift_pool,
          target_lift_goals,
          created_at,
          updated_at
        FROM training_blocks
        WHERE status = 'archived'
        ORDER BY updated_at DESC
      `,
    );

    return Promise.all(
      archivedBlockRows.map(async (blockRow) => {
        const [latestRevision, sessionCounts] = await Promise.all([
          this.database.getFirstAsync<BlockRevisionRow>(
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
            blockRow.id,
          ),
          this.database.getFirstAsync<SessionCountRow>(
            `
              SELECT
                COUNT(*) AS total_sessions,
                SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) AS completed_sessions,
                SUM(CASE WHEN session_type = 'benchmark' THEN 1 ELSE 0 END) AS benchmark_sessions,
                SUM(CASE WHEN session_type = 'final-test' THEN 1 ELSE 0 END) AS final_test_sessions
              FROM planned_sessions
              WHERE block_id = ?
            `,
            blockRow.id,
          ),
        ]);

        return {
          blockId: blockRow.id,
          blockName: blockRow.name,
          startDate: blockRow.start_date,
          endDate: blockRow.end_date,
          archivedAt: blockRow.updated_at,
          durationWeeks: blockRow.duration_weeks,
          completedSessions: sessionCounts?.completed_sessions ?? 0,
          totalSessions: sessionCounts?.total_sessions ?? 0,
          benchmarkSessionCount: sessionCounts?.benchmark_sessions ?? 0,
          finalTestSessionCount: sessionCounts?.final_test_sessions ?? 0,
          latestRevisionSummary: latestRevision?.summary ?? null,
        };
      }),
    );
  }

  async getActiveBlockAdaptationSummariesAsync(): Promise<readonly AdaptationSummary[]> {
    const activeBlock = await this.getActiveTrainingBlockAsync();

    if (activeBlock === null) {
      return [];
    }

    const rows = await this.database.getAllAsync<AdaptationSummaryRow>(
      `
        SELECT
          adaptation_events.id AS event_id,
          adaptation_events.block_revision_id AS block_revision_id,
          adaptation_events.triggered_at AS triggered_at,
          adaptation_events.event_type AS event_type,
          adaptation_events.reason_code AS reason_code,
          adaptation_events.summary AS summary,
          event_explanation.headline AS event_headline,
          event_explanation.body AS event_body,
          revision_explanation.headline AS revision_headline,
          revision_explanation.body AS revision_body
        FROM adaptation_events
        LEFT JOIN explanation_records AS event_explanation
          ON event_explanation.owner_type = 'adaptation-event'
         AND event_explanation.owner_id = adaptation_events.id
        LEFT JOIN explanation_records AS revision_explanation
          ON revision_explanation.owner_type = 'block-revision'
         AND revision_explanation.owner_id = adaptation_events.block_revision_id
        WHERE adaptation_events.block_id = ?
        ORDER BY adaptation_events.triggered_at DESC, adaptation_events.id DESC
      `,
      activeBlock.block.id,
    );

    return rows.map((row) => ({
      eventId: row.event_id,
      blockRevisionId: row.block_revision_id,
      triggeredAt: row.triggered_at,
      eventType: row.event_type,
      reasonCode: row.reason_code,
      summary: row.summary,
      headline: row.event_headline ?? "Recent plan change",
      body: row.event_body ?? row.summary,
      revisionHeadline: row.revision_headline,
      revisionBody: row.revision_body,
    }));
  }

  async getActiveLpPlanReviewAsync(): Promise<ActiveLpPlanReview | null> {
    const activeBlock = await this.getActiveTrainingBlockAsync();

    if (activeBlock === null) {
      return null;
    }

    const [programState, goalProgress, recentCheckpoints, mesocycleExtensions] = await Promise.all([
      this.getLpProgramStateAsync(activeBlock.block.id),
      this.getLpGoalProgressAsync(activeBlock.block.id),
      this.getLpCheckpointResultsAsync(activeBlock.block.id),
      this.database.getAllAsync<LpMesocycleExtensionRow>(
        `
          SELECT
            id,
            block_id,
            triggered_by_checkpoint_result_id,
            added_phase,
            added_weeks,
            reason,
            created_at
          FROM lp_mesocycle_extensions
          WHERE block_id = ?
          ORDER BY created_at DESC
        `,
        activeBlock.block.id,
      ),
    ]);

    if (programState === null) {
      return null;
    }

    return {
      programLevel: programState.programLevel,
      currentPhase: programState.currentPhase,
      nextCheckpointType: programState.nextCheckpointType,
      activeDeloadUntilSessionIndex: programState.activeDeloadUntilSessionIndex,
      goalProgress,
      recentCheckpoints: recentCheckpoints.slice(0, 6),
      mesocycleExtensions: mesocycleExtensions.map((extension) => ({
        id: extension.id,
        addedPhase: extension.added_phase,
        addedWeeks: extension.added_weeks,
        reason: extension.reason,
        createdAt: extension.created_at,
      })),
    };
  }
}
