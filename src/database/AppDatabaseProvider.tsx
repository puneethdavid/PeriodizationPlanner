import type { PropsWithChildren, ReactNode } from "react";

import { createContext, use, useEffect, useState } from "react";
import { Text } from "react-native";
import type { SQLiteDatabase } from "expo-sqlite";

import { PlaceholderScreen } from "@/components/navigation/PlaceholderScreen";
import { LoadingState } from "@/components/ui";
import { getAppDatabaseAsync } from "@/database/client";
import { createRepositoryContext, type RepositoryContext } from "@/database/repository";
import { latestSchemaVersion } from "@/database/migrations";
import { appTheme } from "@/theme/appTheme";

type DatabaseStatus = "loading" | "ready" | "error";

type AppDatabaseContextValue = {
  database: SQLiteDatabase;
  repositoryContext: RepositoryContext;
  schemaVersion: number;
};

const AppDatabaseContext = createContext<AppDatabaseContextValue | null>(null);

const DatabaseLoadingScreen = () => {
  return (
    <PlaceholderScreen
      eyebrow="Local Data"
      title="Preparing database"
      description="Initializing the local SQLite foundation for plans, logs, and future sync-safe persistence."
    >
      <LoadingState
        title="Running local setup"
        description="Migrations and repository foundations are being prepared once at app startup."
      />
    </PlaceholderScreen>
  );
};

const DatabaseErrorScreen = ({ error }: { error: Error }) => {
  return (
    <PlaceholderScreen
      eyebrow="Local Data"
      title="Database startup failed"
      description="The app could not initialize its local SQLite store. Fix the startup error before continuing."
    >
      <LoadingState
        title="Initialization stopped"
        description="Check the development error details below before continuing."
      />
      <Text style={{ marginTop: 18, color: appTheme.colors.textSecondary }}>{error.message}</Text>
    </PlaceholderScreen>
  );
};

const DatabaseReady = ({
  children,
  database,
}: PropsWithChildren<{ database: SQLiteDatabase }>): ReactNode => {
  const value: AppDatabaseContextValue = {
    database,
    repositoryContext: createRepositoryContext(database),
    schemaVersion: latestSchemaVersion,
  };

  return <AppDatabaseContext.Provider value={value}>{children}</AppDatabaseContext.Provider>;
};

export const AppDatabaseProvider = ({ children }: PropsWithChildren) => {
  const [status, setStatus] = useState<DatabaseStatus>("loading");
  const [database, setDatabase] = useState<SQLiteDatabase | null>(null);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let isMounted = true;

    void getAppDatabaseAsync()
      .then((resolvedDatabase) => {
        if (!isMounted) {
          return;
        }

        setDatabase(resolvedDatabase);
        setStatus("ready");
      })
      .catch((resolvedError: unknown) => {
        if (!isMounted) {
          return;
        }

        setError(
          resolvedError instanceof Error
            ? resolvedError
            : new Error("[database] Unknown startup error."),
        );
        setStatus("error");
      });

    return () => {
      isMounted = false;
    };
  }, []);

  if (status === "error" && error !== null) {
    return <DatabaseErrorScreen error={error} />;
  }

  if (status === "loading" || database === null) {
    return <DatabaseLoadingScreen />;
  }

  return <DatabaseReady database={database}>{children}</DatabaseReady>;
};

export const useAppDatabase = (): AppDatabaseContextValue => {
  const context = use(AppDatabaseContext);

  if (context === null) {
    throw new Error("[database] useAppDatabase must be used within AppDatabaseProvider.");
  }

  return context;
};

export type { AppDatabaseContextValue };
