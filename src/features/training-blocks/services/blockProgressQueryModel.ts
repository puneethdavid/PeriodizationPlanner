import type { GeneratedTrainingPlan } from "@/features/training-blocks/schema/trainingBlockSchemas";

export type BlockProgressQueryModel =
  | {
      state: "no-active-block";
      message: string;
    }
  | {
      state: "ready";
      blockName: string;
      totalSessions: number;
      completedSessions: number;
      remainingSessions: number;
      currentWeek: number | null;
      deloadWeek: number | null;
      completedSessionTitles: readonly string[];
      upcomingSessionTitles: readonly string[];
    };

export const buildBlockProgressQueryModel = (
  activePlan: GeneratedTrainingPlan | null,
): BlockProgressQueryModel => {
  if (activePlan === null) {
    return {
      state: "no-active-block",
      message: "Generate an active block first to see local progress through the current plan.",
    };
  }

  const completedSessions = activePlan.sessions.filter((session) => session.status === "completed");
  const remainingSessions = activePlan.sessions.filter((session) => session.status !== "completed");
  const currentWeek = remainingSessions[0]?.weekIndex ?? null;
  const deloadWeek =
    activePlan.sessions.find((session) => session.sessionType === "deload")?.weekIndex ?? null;

  return {
    state: "ready",
    blockName: activePlan.block.name,
    totalSessions: activePlan.sessions.length,
    completedSessions: completedSessions.length,
    remainingSessions: remainingSessions.length,
    currentWeek,
    deloadWeek,
    completedSessionTitles: completedSessions.slice(0, 3).map((session) => session.title),
    upcomingSessionTitles: remainingSessions.slice(0, 3).map((session) => session.title),
  };
};
