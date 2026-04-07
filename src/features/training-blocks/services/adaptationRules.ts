import type { PlannedExercise, PlannedSession } from "@/features/training-blocks/schema/trainingBlockSchemas";
import type {
  AdaptationRuleResult,
  AdaptationSignal,
  ProposedSessionAdjustment,
  ProposedSetAdjustment,
} from "@/features/training-blocks/services/adaptationEngineContracts";

const progressionLoadMultiplier = 1.025;
const deloadLoadMultiplier = 0.925;
const stalledRepsReduction = 1;
const deloadRepsReduction = 1;
const stalledRpeReduction = 0.5;
const deloadRpeReduction = 1;
const progressionSessionLimit = 2;
const stalledSessionLimit = 1;
const deloadSessionLimit = 2;

const adaptableSessionTypes = new Set<PlannedSession["sessionType"]>(["primary", "secondary", "deload"]);

const roundLoad = (value: number): number => Number(value.toFixed(1));

const clampReps = (value: number): number => Math.max(1, Math.round(value));
const clampRpe = (value: number | null): number | null => {
  if (value === null) {
    return null;
  }

  return Number(Math.min(10, Math.max(5, value)).toFixed(1));
};

const getSignalPriority = (signal: AdaptationSignal): number => {
  switch (signal.signalType) {
    case "deload-needed":
      return 3;
    case "stalled-performance":
      return 2;
    case "progression-opportunity":
      return 1;
  }
};

const sortSignalsByPriority = (signals: readonly AdaptationSignal[]): readonly AdaptationSignal[] => {
  return [...signals].sort((left, right) => getSignalPriority(right) - getSignalPriority(left));
};

const getAdjustmentWindow = (signal: AdaptationSignal): number => {
  switch (signal.signalType) {
    case "progression-opportunity":
      return progressionSessionLimit;
    case "stalled-performance":
      return stalledSessionLimit;
    case "deload-needed":
      return deloadSessionLimit;
  }
};

const adjustSetForSignal = (
  plannedSet: PlannedExercise["plannedSets"][number],
  signal: AdaptationSignal,
): ProposedSetAdjustment => {
  switch (signal.signalType) {
    case "progression-opportunity":
      return {
        plannedSetId: plannedSet.id,
        targetLoad: roundLoad(plannedSet.targetLoad * progressionLoadMultiplier),
        targetReps: plannedSet.targetReps,
        targetRpe: plannedSet.targetRpe,
      };
    case "stalled-performance":
      return {
        plannedSetId: plannedSet.id,
        targetLoad: plannedSet.targetLoad,
        targetReps: clampReps(plannedSet.targetReps - stalledRepsReduction),
        targetRpe: clampRpe(
          plannedSet.targetRpe === null ? null : plannedSet.targetRpe - stalledRpeReduction,
        ),
      };
    case "deload-needed":
      return {
        plannedSetId: plannedSet.id,
        targetLoad: roundLoad(plannedSet.targetLoad * deloadLoadMultiplier),
        targetReps: clampReps(plannedSet.targetReps - deloadRepsReduction),
        targetRpe: clampRpe(
          plannedSet.targetRpe === null ? 6 : Math.min(6, plannedSet.targetRpe - deloadRpeReduction),
        ),
      };
  }
};

const buildSessionAdjustment = (
  session: PlannedSession,
  signal: AdaptationSignal,
): ProposedSessionAdjustment | null => {
  if (!adaptableSessionTypes.has(session.sessionType)) {
    return null;
  }

  const matchingExercises = session.plannedExercises.filter((exercise) => exercise.liftSlug === signal.liftSlug);

  if (matchingExercises.length === 0) {
    return null;
  }

  return {
    sessionId: session.id,
    reasonCode: signal.signalType,
    summary: signal.reason,
    setAdjustments: matchingExercises.flatMap((exercise) =>
      exercise.plannedSets.map((plannedSet) => adjustSetForSignal(plannedSet, signal)),
    ),
  };
};

const summarizeRuleOutcome = (signals: readonly AdaptationSignal[]): string => {
  const signalCounts = {
    progression: signals.filter((signal) => signal.signalType === "progression-opportunity").length,
    hold: signals.filter((signal) => signal.signalType === "stalled-performance").length,
    deload: signals.filter((signal) => signal.signalType === "deload-needed").length,
  };

  const parts = [
    signalCounts.progression > 0 ? `${signalCounts.progression} progression bump${signalCounts.progression === 1 ? "" : "s"}` : null,
    signalCounts.hold > 0 ? `${signalCounts.hold} hold adjustment${signalCounts.hold === 1 ? "" : "s"}` : null,
    signalCounts.deload > 0 ? `${signalCounts.deload} deload adjustment${signalCounts.deload === 1 ? "" : "s"}` : null,
  ].filter((part): part is string => part !== null);

  return parts.length === 0
    ? "No future-session changes proposed from the current workout feedback."
    : `Applied ${parts.join(", ")} to future sessions.`;
};

export const applyAdaptationRules = (input: {
  futureSessions: readonly PlannedSession[];
  adaptationSignals: readonly AdaptationSignal[];
}): AdaptationRuleResult => {
  const sortedSignals = sortSignalsByPriority(input.adaptationSignals);
  const proposedSessionAdjustments: ProposedSessionAdjustment[] = [];
  const appliedSessionsByLift = new Map<AdaptationSignal["liftSlug"], number>();

  sortedSignals.forEach((signal) => {
    const sessionLimit = getAdjustmentWindow(signal);
    let appliedSessions = appliedSessionsByLift.get(signal.liftSlug) ?? 0;

    input.futureSessions.forEach((session) => {
      if (appliedSessions >= sessionLimit) {
        return;
      }

      const adjustment = buildSessionAdjustment(session, signal);

      if (adjustment === null) {
        return;
      }

      proposedSessionAdjustments.push(adjustment);
      appliedSessions += 1;
    });

    appliedSessionsByLift.set(signal.liftSlug, appliedSessions);
  });

  const leadSignal = sortedSignals[0];

  return {
    adaptationSignals: sortedSignals,
    proposedSessionAdjustments,
    reason: leadSignal?.signalType ?? "no-change",
    summary: summarizeRuleOutcome(sortedSignals),
  };
};

export const adaptationRuleConstants = {
  progressionLoadMultiplier,
  deloadLoadMultiplier,
  stalledRepsReduction,
  deloadRepsReduction,
  stalledRpeReduction,
  deloadRpeReduction,
  progressionSessionLimit,
  stalledSessionLimit,
  deloadSessionLimit,
} as const;
