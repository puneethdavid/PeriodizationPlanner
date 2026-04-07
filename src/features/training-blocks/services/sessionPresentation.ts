import type { PlannedSession } from "@/features/training-blocks/schema/trainingBlockSchemas";

export const getSessionStatusLabel = (session: Pick<PlannedSession, "status">): string => {
  switch (session.status) {
    case "completed":
      return "Completed";
    case "skipped":
      return "Missed";
    case "planned":
    default:
      return "Planned";
  }
};

export const getSessionKindLabel = (
  session: Pick<PlannedSession, "sessionType">,
): string => {
  switch (session.sessionType) {
    case "benchmark":
      return "Benchmark";
    case "final-test":
      return "Final Test";
    case "deload":
      return "Deload";
    case "primary":
      return "Primary";
    case "secondary":
    default:
      return "Support";
  }
};
