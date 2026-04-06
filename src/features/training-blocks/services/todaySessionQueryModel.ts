import type { GeneratedTrainingPlan, PlannedSession } from "@/features/training-blocks/schema/trainingBlockSchemas";

type TodaySessionReadyState = {
  state: "ready";
  activeBlockId: string;
  activeBlockName: string;
  activeBlockGoal: string;
  sessionId: string;
  sessionTitle: string;
  scheduledDate: string;
  sessionType: PlannedSession["sessionType"];
  sessionIndex: number;
  exerciseCount: number;
  plannedSetCount: number;
};

type TodaySessionEmptyState = {
  state: "no-active-block" | "no-session-scheduled";
  message: string;
};

export type TodaySessionQueryModel = TodaySessionReadyState | TodaySessionEmptyState;

const getTodayIsoDate = (): string => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const selectCurrentSession = (
  sessions: readonly PlannedSession[],
  todayIsoDate: string,
): PlannedSession | null => {
  const incompleteSessions = sessions.filter((session) => session.status !== "completed");

  if (incompleteSessions.length === 0) {
    return null;
  }

  const dueSession =
    incompleteSessions.find((session) => session.scheduledDate <= todayIsoDate) ?? null;

  return dueSession ?? incompleteSessions[0] ?? null;
};

export const buildTodaySessionQueryModel = (
  activePlan: GeneratedTrainingPlan | null,
): TodaySessionQueryModel => {
  if (activePlan === null) {
    return {
      state: "no-active-block",
      message: "Generate an active block from saved benchmarks before opening today’s session.",
    };
  }

  const currentSession = selectCurrentSession(activePlan.sessions, getTodayIsoDate());

  if (currentSession === null) {
    return {
      state: "no-session-scheduled",
      message: "The active block has no remaining scheduled sessions to show today.",
    };
  }

  return {
    state: "ready",
    activeBlockId: activePlan.block.id,
    activeBlockName: activePlan.block.name,
    activeBlockGoal: activePlan.block.goalSlug,
    sessionId: currentSession.id,
    sessionTitle: currentSession.title,
    scheduledDate: currentSession.scheduledDate,
    sessionType: currentSession.sessionType,
    sessionIndex: currentSession.sessionIndex,
    exerciseCount: currentSession.plannedExercises.length,
    plannedSetCount: currentSession.plannedExercises.reduce(
      (count, exercise) => count + exercise.plannedSets.length,
      0,
    ),
  };
};
