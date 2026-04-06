import { BaseRepository, type RepositoryContext } from "@/database/repository";

type MigrationCountRow = {
  count: number;
};

export type DatabaseSummary = {
  databasePath: string;
  migrationCount: number;
};

export class AppShellRepository extends BaseRepository {
  constructor(context: RepositoryContext) {
    super(context);
  }

  async getDatabaseSummaryAsync(): Promise<DatabaseSummary> {
    const migrationCountRow = await this.database.getFirstAsync<MigrationCountRow>(
      "SELECT COUNT(*) as count FROM schema_migrations",
    );

    return {
      databasePath: this.database.databasePath,
      migrationCount: migrationCountRow?.count ?? 0,
    };
  }
}
