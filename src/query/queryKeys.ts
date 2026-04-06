export const queryKeys = {
  appShell: {
    all: ["app-shell"] as const,
    databaseSummary: () => ["app-shell", "database-summary"] as const,
  },
  trainingBlocks: {
    all: ["training-blocks"] as const,
    benchmarks: () => ["training-blocks", "benchmarks"] as const,
    activePlan: () => ["training-blocks", "active-plan"] as const,
  },
  today: {
    all: ["today"] as const,
    activeSession: () => ["today", "active-session"] as const,
  },
  workouts: {
    all: ["workouts"] as const,
    detail: (sessionId: string) => ["workouts", "detail", sessionId] as const,
  },
} as const;
