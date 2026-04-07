import type { LoggedSetResult, PlannedExercise } from "@/features/training-blocks/schema/trainingBlockSchemas";
import type {
  AdaptationSignal,
  AdaptationTrigger,
  AdaptationWorkoutReview,
} from "@/features/training-blocks/services/adaptationEngineContracts";

const recentReviewWindow = 3;
const progressionCompletionRateThreshold = 0.95;
const progressionPrescriptionRateThreshold = 0.9;
const progressionDifficultyThreshold = 7.5;
const stalledPrescriptionRateThreshold = 0.75;
const stalledDifficultyThreshold = 8;
const deloadCompletionRateThreshold = 0.6;
const deloadDifficultyThreshold = 9;

type LiftSessionPerformance = {
  liftSlug: PlannedExercise["liftSlug"];
  completedSetRate: number;
  prescriptionMatchRate: number;
  averageLoadDelta: number;
  averageRepDelta: number;
  perceivedDifficulty: number | null;
  completionStatus: AdaptationWorkoutReview["workoutResult"]["completionStatus"];
};

const roundMetric = (value: number): number => Number(value.toFixed(2));

const uniqueLiftSlugs = (reviews: readonly AdaptationWorkoutReview[]): readonly PlannedExercise["liftSlug"][] => {
  const seenLiftSlugs = new Set<PlannedExercise["liftSlug"]>();

  reviews.forEach((review) => {
    review.session.plannedExercises.forEach((exercise) => {
      seenLiftSlugs.add(exercise.liftSlug);
    });
  });

  return [...seenLiftSlugs];
};

const getLoggedSetResultByPlannedSetId = (
  loggedSetResults: readonly LoggedSetResult[],
): ReadonlyMap<string, LoggedSetResult> => {
  return new Map(
    loggedSetResults
      .flatMap((loggedSetResult) =>
        loggedSetResult.plannedSetId === null
          ? []
          : ([[loggedSetResult.plannedSetId, loggedSetResult] as const] satisfies readonly [
              string,
              LoggedSetResult,
            ][]),
      ),
  );
};

const summarizeLiftSessionPerformance = (
  review: AdaptationWorkoutReview,
  liftSlug: PlannedExercise["liftSlug"],
): LiftSessionPerformance | null => {
  const matchingExercises = review.session.plannedExercises.filter((exercise) => exercise.liftSlug === liftSlug);

  if (matchingExercises.length === 0) {
    return null;
  }

  const loggedSetResultsByPlannedSetId = getLoggedSetResultByPlannedSetId(review.loggedSetResults);
  const plannedSets = matchingExercises.flatMap((exercise) => exercise.plannedSets);

  if (plannedSets.length === 0) {
    return null;
  }

  let completedSets = 0;
  let prescriptionMatches = 0;
  let loadDeltaTotal = 0;
  let repDeltaTotal = 0;

  plannedSets.forEach((plannedSet) => {
    const loggedSetResult = loggedSetResultsByPlannedSetId.get(plannedSet.id);

    if (loggedSetResult?.isCompleted === true) {
      completedSets += 1;
    }

    const actualLoad = loggedSetResult?.actualLoad ?? plannedSet.targetLoad;
    const actualReps = loggedSetResult?.actualReps ?? plannedSet.targetReps;
    const metPrescription =
      (loggedSetResult?.isCompleted ?? false) &&
      actualLoad >= plannedSet.targetLoad &&
      actualReps >= plannedSet.targetReps;

    if (metPrescription) {
      prescriptionMatches += 1;
    }

    loadDeltaTotal += actualLoad - plannedSet.targetLoad;
    repDeltaTotal += actualReps - plannedSet.targetReps;
  });

  return {
    liftSlug,
    completedSetRate: roundMetric(completedSets / plannedSets.length),
    prescriptionMatchRate: roundMetric(prescriptionMatches / plannedSets.length),
    averageLoadDelta: roundMetric(loadDeltaTotal / plannedSets.length),
    averageRepDelta: roundMetric(repDeltaTotal / plannedSets.length),
    perceivedDifficulty: review.workoutResult.perceivedDifficulty,
    completionStatus: review.workoutResult.completionStatus,
  };
};

const isStrongProgressionSession = (performance: LiftSessionPerformance): boolean => {
  const difficulty = performance.perceivedDifficulty ?? progressionDifficultyThreshold;

  return (
    performance.completionStatus === "completed" &&
    performance.completedSetRate >= progressionCompletionRateThreshold &&
    performance.prescriptionMatchRate >= progressionPrescriptionRateThreshold &&
    difficulty <= progressionDifficultyThreshold
  );
};

const isStalledSession = (performance: LiftSessionPerformance): boolean => {
  const difficulty = performance.perceivedDifficulty ?? stalledDifficultyThreshold;

  return (
    performance.completionStatus === "partial" ||
    performance.prescriptionMatchRate < stalledPrescriptionRateThreshold ||
    difficulty >= stalledDifficultyThreshold
  );
};

const isDeloadSession = (performance: LiftSessionPerformance): boolean => {
  const difficulty = performance.perceivedDifficulty ?? deloadDifficultyThreshold;

  return (
    performance.completionStatus === "missed" ||
    performance.completedSetRate <= deloadCompletionRateThreshold ||
    difficulty >= deloadDifficultyThreshold
  );
};

const buildProgressionReason = (
  liftSlug: PlannedExercise["liftSlug"],
  performances: readonly LiftSessionPerformance[],
): string => {
  const latestPerformance = performances[0];

  if (latestPerformance === undefined) {
    return `Recent ${liftSlug} sessions cleared the planned work cleanly.`;
  }

  return `${liftSlug} hit ${Math.round(latestPerformance.prescriptionMatchRate * 100)}% of planned sets at or above target with manageable difficulty.`;
};

const buildStalledReason = (
  liftSlug: PlannedExercise["liftSlug"],
  performances: readonly LiftSessionPerformance[],
): string => {
  const latestPerformance = performances[0];

  if (latestPerformance === undefined) {
    return `${liftSlug} is showing inconsistent execution.`;
  }

  return `${liftSlug} only matched ${Math.round(latestPerformance.prescriptionMatchRate * 100)}% of planned sets and may need a hold before progressing further.`;
};

const buildDeloadReason = (
  liftSlug: PlannedExercise["liftSlug"],
  performances: readonly LiftSessionPerformance[],
): string => {
  const latestPerformance = performances[0];

  if (latestPerformance === undefined) {
    return `${liftSlug} is showing a clear fatigue signal.`;
  }

  return `${liftSlug} dropped to ${Math.round(latestPerformance.completedSetRate * 100)}% completed sets with high fatigue, which points to a deload.`;
};

const buildSignalForLift = (
  liftSlug: PlannedExercise["liftSlug"],
  performances: readonly LiftSessionPerformance[],
): AdaptationSignal | null => {
  if (performances.length === 0) {
    return null;
  }

  const progressionHits = performances.filter(isStrongProgressionSession).length;
  const stalledHits = performances.filter(isStalledSession).length;
  const deloadHits = performances.filter(isDeloadSession).length;

  if (deloadHits >= 2 || (deloadHits >= 1 && stalledHits >= 2)) {
    return {
      signalType: "deload-needed",
      liftSlug,
      direction: "decrease",
      confidence: deloadHits >= 2 ? "high" : "medium",
      reason: buildDeloadReason(liftSlug, performances),
    };
  }

  if (progressionHits >= 2 && stalledHits === 0) {
    return {
      signalType: "progression-opportunity",
      liftSlug,
      direction: "increase",
      confidence: progressionHits >= 3 ? "high" : "medium",
      reason: buildProgressionReason(liftSlug, performances),
    };
  }

  if (stalledHits >= 2 || (stalledHits >= 1 && progressionHits === 0)) {
    return {
      signalType: "stalled-performance",
      liftSlug,
      direction: "hold",
      confidence: stalledHits >= 2 ? "high" : "medium",
      reason: buildStalledReason(liftSlug, performances),
    };
  }

  return null;
};

export const evaluateAdaptationSignals = (input: {
  trigger: AdaptationTrigger;
  recentWorkoutReviews: readonly AdaptationWorkoutReview[];
}): readonly AdaptationSignal[] => {
  const reviews = [
    {
      session: input.trigger.completedSession,
      workoutResult: input.trigger.workoutResult,
      loggedSetResults: input.trigger.loggedSetResults,
    },
    ...input.recentWorkoutReviews.filter((review) => review.session.id !== input.trigger.sessionId),
  ].slice(0, recentReviewWindow);

  return uniqueLiftSlugs(reviews)
    .map((liftSlug) => {
      const performances = reviews
        .map((review) => summarizeLiftSessionPerformance(review, liftSlug))
        .filter((performance): performance is LiftSessionPerformance => performance !== null);

      return buildSignalForLift(liftSlug, performances);
    })
    .filter((signal): signal is AdaptationSignal => signal !== null);
};

export const adaptationHeuristicThresholds = {
  recentReviewWindow,
  progressionCompletionRateThreshold,
  progressionPrescriptionRateThreshold,
  progressionDifficultyThreshold,
  stalledPrescriptionRateThreshold,
  stalledDifficultyThreshold,
  deloadCompletionRateThreshold,
  deloadDifficultyThreshold,
} as const;
