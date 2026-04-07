import type { PlannedSession } from "@/features/training-blocks/schema/trainingBlockSchemas";
import type { ProposedPlanRevision } from "@/features/training-blocks/services/adaptationEngineContracts";

export const buildUpdatedFutureSessions = (input: {
  futureSessions: readonly PlannedSession[];
  proposedRevision: ProposedPlanRevision;
}): readonly PlannedSession[] => {
  const sessionAdjustmentsBySessionId = new Map(
    input.proposedRevision.proposedSessionAdjustments.map((sessionAdjustment) => [
      sessionAdjustment.sessionId,
      sessionAdjustment,
    ]),
  );

  return input.futureSessions.map((futureSession) => {
    const sessionAdjustment = sessionAdjustmentsBySessionId.get(futureSession.id);
    const setAdjustmentsById = new Map(
      (sessionAdjustment?.setAdjustments ?? []).map((setAdjustment) => [
        setAdjustment.plannedSetId,
        setAdjustment,
      ]),
    );

    return {
      ...futureSession,
      plannedExercises: futureSession.plannedExercises.map((exercise) => ({
        ...exercise,
        plannedSets: exercise.plannedSets.map((plannedSet) => {
          const setAdjustment = setAdjustmentsById.get(plannedSet.id);

          if (setAdjustment === undefined) {
            return plannedSet;
          }

          return {
            ...plannedSet,
            targetLoad: setAdjustment.targetLoad,
            targetReps: setAdjustment.targetReps,
            targetRpe: setAdjustment.targetRpe,
          };
        }),
      })),
    };
  });
};
