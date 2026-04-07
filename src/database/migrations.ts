export type Migration = {
  version: number;
  name: string;
  statements: readonly string[];
};

export const appDatabaseName = "periodization-planner.db";

export const migrations: readonly Migration[] = [
  {
    version: 1,
    name: "bootstrap-app-meta",
    statements: [
      `
        CREATE TABLE IF NOT EXISTS app_meta (
          key TEXT PRIMARY KEY NOT NULL,
          value TEXT
        );
      `,
    ],
  },
  {
    version: 2,
    name: "training-block-engine-foundation",
    statements: [
      `
        CREATE TABLE IF NOT EXISTS benchmarks (
          id TEXT PRIMARY KEY NOT NULL,
          lift_slug TEXT NOT NULL UNIQUE,
          benchmark_type TEXT NOT NULL,
          value REAL NOT NULL,
          unit TEXT NOT NULL,
          captured_at TEXT NOT NULL,
          notes TEXT,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );
      `,
      `
        CREATE TABLE IF NOT EXISTS benchmark_snapshots (
          id TEXT PRIMARY KEY NOT NULL,
          created_at TEXT NOT NULL
        );
      `,
      `
        CREATE TABLE IF NOT EXISTS benchmark_snapshot_items (
          id TEXT PRIMARY KEY NOT NULL,
          snapshot_id TEXT NOT NULL,
          benchmark_id TEXT,
          lift_slug TEXT NOT NULL,
          benchmark_type TEXT NOT NULL,
          value REAL NOT NULL,
          unit TEXT NOT NULL,
          captured_at TEXT NOT NULL,
          notes TEXT,
          FOREIGN KEY (snapshot_id) REFERENCES benchmark_snapshots(id) ON DELETE CASCADE,
          FOREIGN KEY (benchmark_id) REFERENCES benchmarks(id) ON DELETE SET NULL
        );
      `,
      `
        CREATE TABLE IF NOT EXISTS training_blocks (
          id TEXT PRIMARY KEY NOT NULL,
          name TEXT NOT NULL,
          status TEXT NOT NULL,
          goal_slug TEXT NOT NULL,
          start_date TEXT NOT NULL,
          end_date TEXT NOT NULL,
          benchmark_snapshot_id TEXT NOT NULL,
          generation_version TEXT NOT NULL,
          notes TEXT,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          FOREIGN KEY (benchmark_snapshot_id) REFERENCES benchmark_snapshots(id) ON DELETE RESTRICT
        );
      `,
      `
        CREATE TABLE IF NOT EXISTS block_revisions (
          id TEXT PRIMARY KEY NOT NULL,
          block_id TEXT NOT NULL,
          revision_number INTEGER NOT NULL,
          reason TEXT NOT NULL,
          summary TEXT NOT NULL,
          created_at TEXT NOT NULL,
          FOREIGN KEY (block_id) REFERENCES training_blocks(id) ON DELETE CASCADE,
          UNIQUE (block_id, revision_number)
        );
      `,
      `
        CREATE TABLE IF NOT EXISTS planned_sessions (
          id TEXT PRIMARY KEY NOT NULL,
          block_id TEXT NOT NULL,
          block_revision_id TEXT NOT NULL,
          scheduled_date TEXT NOT NULL,
          session_index INTEGER NOT NULL,
          week_index INTEGER NOT NULL,
          session_type TEXT NOT NULL,
          title TEXT NOT NULL,
          status TEXT NOT NULL,
          FOREIGN KEY (block_id) REFERENCES training_blocks(id) ON DELETE CASCADE,
          FOREIGN KEY (block_revision_id) REFERENCES block_revisions(id) ON DELETE CASCADE,
          UNIQUE (block_revision_id, session_index)
        );
      `,
      `
        CREATE TABLE IF NOT EXISTS planned_exercises (
          id TEXT PRIMARY KEY NOT NULL,
          session_id TEXT NOT NULL,
          lift_slug TEXT NOT NULL,
          exercise_slug TEXT NOT NULL,
          exercise_name TEXT NOT NULL,
          exercise_order INTEGER NOT NULL,
          prescription_kind TEXT NOT NULL,
          FOREIGN KEY (session_id) REFERENCES planned_sessions(id) ON DELETE CASCADE,
          UNIQUE (session_id, exercise_order)
        );
      `,
      `
        CREATE TABLE IF NOT EXISTS planned_sets (
          id TEXT PRIMARY KEY NOT NULL,
          planned_exercise_id TEXT NOT NULL,
          set_index INTEGER NOT NULL,
          target_reps INTEGER NOT NULL,
          target_load REAL NOT NULL,
          target_rpe REAL,
          rest_seconds INTEGER,
          tempo TEXT,
          is_amrap INTEGER NOT NULL DEFAULT 0,
          FOREIGN KEY (planned_exercise_id) REFERENCES planned_exercises(id) ON DELETE CASCADE,
          UNIQUE (planned_exercise_id, set_index)
        );
      `,
      `
        CREATE TABLE IF NOT EXISTS workout_results (
          id TEXT PRIMARY KEY NOT NULL,
          session_id TEXT NOT NULL UNIQUE,
          completed_at TEXT NOT NULL,
          completion_status TEXT NOT NULL,
          notes TEXT,
          perceived_difficulty REAL,
          FOREIGN KEY (session_id) REFERENCES planned_sessions(id) ON DELETE CASCADE
        );
      `,
      `
        CREATE TABLE IF NOT EXISTS logged_set_results (
          id TEXT PRIMARY KEY NOT NULL,
          workout_result_id TEXT NOT NULL,
          planned_set_id TEXT,
          set_index INTEGER NOT NULL,
          actual_reps INTEGER,
          actual_load REAL,
          actual_rpe REAL,
          is_completed INTEGER NOT NULL DEFAULT 1,
          FOREIGN KEY (workout_result_id) REFERENCES workout_results(id) ON DELETE CASCADE,
          FOREIGN KEY (planned_set_id) REFERENCES planned_sets(id) ON DELETE SET NULL
        );
      `,
      `
        CREATE TABLE IF NOT EXISTS adaptation_events (
          id TEXT PRIMARY KEY NOT NULL,
          block_id TEXT NOT NULL,
          block_revision_id TEXT,
          triggered_at TEXT NOT NULL,
          event_type TEXT NOT NULL,
          reason_code TEXT NOT NULL,
          summary TEXT NOT NULL,
          FOREIGN KEY (block_id) REFERENCES training_blocks(id) ON DELETE CASCADE,
          FOREIGN KEY (block_revision_id) REFERENCES block_revisions(id) ON DELETE SET NULL
        );
      `,
      `
        CREATE TABLE IF NOT EXISTS explanation_records (
          id TEXT PRIMARY KEY NOT NULL,
          owner_type TEXT NOT NULL,
          owner_id TEXT NOT NULL,
          created_at TEXT NOT NULL,
          headline TEXT NOT NULL,
          body TEXT NOT NULL
        );
      `,
      `
        CREATE INDEX IF NOT EXISTS idx_planned_sessions_block_date
        ON planned_sessions (block_id, scheduled_date);
      `,
      `
        CREATE INDEX IF NOT EXISTS idx_benchmark_snapshot_items_snapshot
        ON benchmark_snapshot_items (snapshot_id);
      `,
      `
        CREATE INDEX IF NOT EXISTS idx_explanation_records_owner
        ON explanation_records (owner_type, owner_id);
      `,
    ],
  },
  {
    version: 3,
    name: "block-scheduling-preferences-and-session-weekdays",
    statements: [
      `
        CREATE TABLE IF NOT EXISTS block_setup_preferences (
          id TEXT PRIMARY KEY NOT NULL,
          training_days_per_week INTEGER NOT NULL,
          selected_training_weekdays TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );
      `,
      `
        ALTER TABLE training_blocks
        ADD COLUMN training_days_per_week INTEGER;
      `,
      `
        ALTER TABLE training_blocks
        ADD COLUMN selected_training_weekdays TEXT;
      `,
      `
        ALTER TABLE planned_sessions
        ADD COLUMN scheduled_weekday TEXT;
      `,
    ],
  },
] as const;

export const latestSchemaVersion = migrations.at(-1)?.version ?? 0;
