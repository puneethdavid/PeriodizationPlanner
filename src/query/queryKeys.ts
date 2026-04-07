export const queryKeys = {
  appShell: {
    all: ["app-shell"] as const,
    databaseSummary: () => ["app-shell", "database-summary"] as const,
  },
  trainingBlocks: {
    all: ["training-blocks"] as const,
    benchmarks: () => ["training-blocks", "benchmarks"] as const,
    configuration: () => ["training-blocks", "configuration"] as const,
    setupPreferences: () => ["training-blocks", "setup-preferences"] as const,
    activePlan: () => ["training-blocks", "active-plan"] as const,
    archivedPlans: () => ["training-blocks", "archived-plans"] as const,
    adaptationSummaries: () => ["training-blocks", "adaptation-summaries"] as const,
    lpReview: () => ["training-blocks", "lp-review"] as const,
    overview: (monthKey?: string) =>
      monthKey === undefined
        ? (["training-blocks", "overview"] as const)
        : (["training-blocks", "overview", monthKey] as const),
  },
  today: {
    all: ["today"] as const,
    activeSession: () => ["today", "active-session"] as const,
  },
  workouts: {
    all: ["workouts"] as const,
    history: (monthKey?: string) =>
      monthKey === undefined
        ? (["workouts", "history"] as const)
        : (["workouts", "history", monthKey] as const),
    detail: (sessionId: string) => ["workouts", "detail", sessionId] as const,
    review: (sessionId: string) => ["workouts", "review", sessionId] as const,
  },
} as const;
