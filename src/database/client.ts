import { openDatabaseAsync, type SQLiteDatabase } from "expo-sqlite";

import { appDatabaseName, migrations } from "@/database/migrations";

type AppliedMigrationRow = {
  version: number;
};

let databasePromise: Promise<SQLiteDatabase> | null = null;

const ensureMigrationTableAsync = async (database: SQLiteDatabase): Promise<void> => {
  await database.execAsync(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS schema_migrations (
      version INTEGER PRIMARY KEY NOT NULL,
      name TEXT NOT NULL,
      applied_at TEXT NOT NULL
    );
  `);
};

const runMigrationsAsync = async (database: SQLiteDatabase): Promise<void> => {
  await ensureMigrationTableAsync(database);

  const appliedMigrations = await database.getAllAsync<AppliedMigrationRow>(
    "SELECT version FROM schema_migrations ORDER BY version ASC",
  );

  const appliedVersions = new Set(appliedMigrations.map((migration) => migration.version));
  const pendingMigrations = migrations.filter(
    (migration) => !appliedVersions.has(migration.version),
  );

  for (const migration of pendingMigrations) {
    try {
      await database.withExclusiveTransactionAsync(async (transaction) => {
        for (const statement of migration.statements) {
          await transaction.execAsync(statement);
        }

        await transaction.runAsync(
          "INSERT INTO schema_migrations (version, name, applied_at) VALUES (?, ?, ?)",
          migration.version,
          migration.name,
          new Date().toISOString(),
        );
      });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown database migration error.";
      throw new Error(
        `[database] Failed while applying migration ${migration.version} (${migration.name}): ${errorMessage}`,
      );
    }
  }
};

const initializeDatabaseAsync = async (): Promise<SQLiteDatabase> => {
  const database = await openDatabaseAsync(appDatabaseName);
  await runMigrationsAsync(database);
  return database;
};

export const getAppDatabaseAsync = (): Promise<SQLiteDatabase> => {
  databasePromise ??= initializeDatabaseAsync();
  return databasePromise;
};
