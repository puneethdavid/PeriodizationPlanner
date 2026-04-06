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
] as const;

export const latestSchemaVersion = migrations.at(-1)?.version ?? 0;
