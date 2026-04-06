import type { SQLiteDatabase } from "expo-sqlite";

export type RepositoryContext = {
  database: SQLiteDatabase;
};

export const createRepositoryContext = (database: SQLiteDatabase): RepositoryContext => {
  return {
    database,
  };
};

export abstract class BaseRepository {
  protected readonly database: SQLiteDatabase;

  protected constructor(context: RepositoryContext) {
    this.database = context.database;
  }
}
