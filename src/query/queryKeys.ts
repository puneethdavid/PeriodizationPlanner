export const queryKeys = {
  appShell: {
    all: ["app-shell"] as const,
    databaseSummary: () => ["app-shell", "database-summary"] as const,
  },
} as const;
