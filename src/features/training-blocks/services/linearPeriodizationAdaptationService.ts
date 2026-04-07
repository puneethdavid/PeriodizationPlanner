import { parseWithSchema } from "@/schema/parseWithSchema";

import type { TrainingBlockRepository } from "@/features/training-blocks/repository/TrainingBlockRepository";
import {
  adaptationEventSchema,
  explanationRecordSchema,
  lpCheckpointResultSchema,
  lpGoalProgressSchema,
  lpLiftProgressionStateSchema,
  lpMesocycleExtensionSchema,
  lpProgramStateSchema,
  type AdaptationEvent,
  type BenchmarkInput,
  type ExplanationRecord,
  type GeneratedTrainingPlan,
  type LoggedSetResult,
  type LpCheckpointResult,
  type LpCheckpointType,
  type LpGoalProgress,
  type LpLiftProgressionState,
  type LpMesocycleExtension,
  type LpProgramPhase,
  type LpProgramState,
  type PlannedExercise,
  type PlannedSession,
  type ProgressionTier,
  type WorkoutResult,
} from "@/features/training-blocks/schema/trainingBlockSchemas";
import {
  type GoalDrivenLpPhaseInstance,
  buildGoalDrivenLpPhaseInstances,
  generateGoalDrivenLpTrainingBlock,
} from "@/features/training-blocks/services/goalDrivenLpGenerator";
import { buildLpProgramStructure } from "@/features/training-blocks/services/linearPeriodizationProgramService";
import {
  getProgressionTierIncrement,
  getUnitProgressionTiers,
  roundToUnitIncrement,
} from "@/features/training-blocks/services/lpProgressionStateService";

type SessionLiftResult = {
  liftSlug: PlannedExercise["liftSlug"];
  unit: BenchmarkInput["unit"];
  expectedLoad: number;
  actualLoad: number;
  metTargets: boolean;
  completionRate: number;
};

type PersistableLpRevision = {
  blockId: string;
  triggeringSessionId: string;
  revisionReason: string;
  revisionSummary: string;
  updatedFutureSessions: readonly PlannedSession[];
  programState: LpProgramState;
  liftStates: readonly LpLiftProgressionState[];
  checkpointResults: readonly LpCheckpointResult[];
  goalProgress: readonly LpGoalProgress[];
  mesocycleExtensions: readonly LpMesocycleExtension[];
  adaptationEvents: readonly AdaptationEvent[];
  explanationRecords: readonly ExplanationRecord[];
};

const checkpointTypeBySession = (
  session: PlannedSession,
): LpCheckpointType | null => session.lpMetadata?.checkpointType ?? null;

const isCheckpointSession = (session: PlannedSession): boolean =>
  session.sessionType === "benchmark" && checkpointTypeBySession(session) !== null;

const isFinalTestSession = (session: PlannedSession): boolean =>
  session.sessionType === "final-test" && checkpointTypeBySession(session) === "two-rep-max";

const getPlannedSetLookup = (
  session: PlannedSession,
): ReadonlyMap<string, PlannedExercise["plannedSets"][number]> =>
  new Map(
    session.plannedExercises.flatMap((exercise) =>
      exercise.plannedSets.map((plannedSet) => [plannedSet.id, plannedSet] as const),
    ),
  );

const summarizeSessionLiftResults = (input: {
  session: PlannedSession;
  loggedSetResults: readonly LoggedSetResult[];
}): readonly SessionLiftResult[] => {
  const plannedSetLookup = getPlannedSetLookup(input.session);

  return input.session.plannedExercises.map((exercise) => {
    const matchingResults = input.loggedSetResults.filter((loggedSetResult) =>
      exercise.plannedSets.some((plannedSet) => plannedSet.id === loggedSetResult.plannedSetId),
    );
    const expectedLoad = Math.max(...exercise.plannedSets.map((plannedSet) => plannedSet.targetLoad));
    const actualLoads = matchingResults
      .map((result) => result.actualLoad)
      .filter((value): value is number => value !== null);
    const completedHits = matchingResults.filter((result) => {
      const plannedSet =
        result.plannedSetId === null ? null : plannedSetLookup.get(result.plannedSetId);

      if (plannedSet === undefined || plannedSet === null) {
        return result.isCompleted;
      }

      return (
        result.isCompleted &&
        (result.actualLoad ?? plannedSet.targetLoad) >= plannedSet.targetLoad &&
        (result.actualReps ?? plannedSet.targetReps) >= plannedSet.targetReps
      );
    }).length;
    const totalSets = Math.max(exercise.plannedSets.length, 1);

    return {
      liftSlug: exercise.liftSlug,
      unit:
        input.session.plannedExercises.find((candidate) => candidate.liftSlug === exercise.liftSlug) !==
        undefined
          ? (matchingResults.find((result) => result.actualLoad !== null) === undefined
              ? "kg"
              : "kg")
          : "kg",
      expectedLoad,
      actualLoad: actualLoads.length === 0 ? expectedLoad : Math.max(...actualLoads),
      metTargets: completedHits >= Math.ceil(totalSets / 2),
      completionRate: completedHits / totalSets,
    };
  });
};

const createEvent = (input: {
  blockId: string;
  eventType: AdaptationEvent["eventType"];
  reasonCode: string;
  summary: string;
  triggeredAt: string;
}): AdaptationEvent =>
  parseWithSchema(
    adaptationEventSchema,
    {
      id: `adaptation_event_${Math.random().toString(36).slice(2, 10)}`,
      blockId: input.blockId,
      blockRevisionId: null,
      triggeredAt: input.triggeredAt,
      eventType: input.eventType,
      reasonCode: input.reasonCode,
      summary: input.summary,
    },
    "training-blocks.lp-adaptation-event",
  );

const createExplanation = (input: {
  ownerType: ExplanationRecord["ownerType"];
  ownerId: string;
  createdAt: string;
  headline: string;
  body: string;
}): ExplanationRecord =>
  parseWithSchema(
    explanationRecordSchema,
    {
      id: `explanation_${Math.random().toString(36).slice(2, 10)}`,
      ownerType: input.ownerType,
      ownerId: input.ownerId,
      createdAt: input.createdAt,
      headline: input.headline,
      body: input.body,
    },
    "training-blocks.lp-explanation-record",
  );

const getSessionPhase = (session: PlannedSession): LpProgramPhase | null =>
  session.lpMetadata?.phase ?? null;

const isAuthoritativeLiftResult = (input: {
  plan: GeneratedTrainingPlan;
  triggerSession: PlannedSession;
  liftSlug: PlannedExercise["liftSlug"];
}): boolean =>
  !input.plan.sessions.some(
    (session) =>
      session.weekIndex === input.triggerSession.weekIndex &&
      session.sessionIndex > input.triggerSession.sessionIndex &&
      session.plannedExercises.some((exercise) => exercise.liftSlug === input.liftSlug),
  );

const getLoadBandThresholds = (unit: BenchmarkInput["unit"]) => ({
  minor: unit === "kg" ? 0.5 : 1.25,
  medium: unit === "kg" ? 2.5 : 5,
  high: unit === "kg" ? 5 : 10,
});

const getNextTierAfterMiss = (tier: ProgressionTier): ProgressionTier => {
  if (tier === "high") {
    return "medium";
  }

  return "minimum";
};

const updateLiftStateFromWeeklyResult = (input: {
  state: LpLiftProgressionState;
  result: SessionLiftResult;
  weekIndex: number;
  phase: LpProgramPhase;
  occurredAt: string;
}): {
  nextState: LpLiftProgressionState;
  summary: string;
  eventType: AdaptationEvent["eventType"];
} => {
  const thresholds = getLoadBandThresholds(input.state.unit);
  const overperformanceDelta = Number((input.result.actualLoad - input.result.expectedLoad).toFixed(2));
  let nextTier = input.state.currentIncrementTier;
  let nextMisses = 0;
  let summary = `${input.state.liftSlug} held the planned weekly progression.`;
  let eventType: AdaptationEvent["eventType"] = "progression-adjustment";

  if (input.result.metTargets) {
    if (overperformanceDelta > thresholds.medium && overperformanceDelta <= thresholds.high) {
      nextTier = "high";
      summary = `${input.state.liftSlug} outperformed the weekly target, so the next progression tier moved up to the high jump.`;
    } else if (
      overperformanceDelta > thresholds.minor &&
      overperformanceDelta <= thresholds.medium
    ) {
      nextTier = "medium";
      summary = `${input.state.liftSlug} landed above the weekly target, so the next progression tier moved up to the medium jump.`;
    } else if (overperformanceDelta > thresholds.high) {
      nextTier = "high";
      summary = `${input.state.liftSlug} cleared the weekly target well above plan. The lift is flagged for checkpoint recalibration while the next week uses the high progression tier.`;
    }
  } else {
    nextTier = getNextTierAfterMiss(input.state.currentIncrementTier);
    nextMisses =
      input.state.lastLoggedLoad !== null &&
      Number(input.state.lastLoggedLoad.toFixed(2)) === Number(input.result.actualLoad.toFixed(2))
        ? input.state.consecutiveSameWeightMisses + 1
        : 1;
    summary = `${input.state.liftSlug} missed most planned sets, so the next weekly progression tier dropped to ${nextTier}.`;
  }

  const checkpointWorthOverperformance = overperformanceDelta > thresholds.high;

  return {
    nextState: parseWithSchema(
      lpLiftProgressionStateSchema,
      {
        ...input.state,
        currentPhase: input.phase,
        currentIncrementTier: nextTier,
        lastExpectedLoad: input.result.expectedLoad,
        lastLoggedLoad: input.result.actualLoad,
        lastSuccessfulLoad: input.result.metTargets
          ? input.result.actualLoad
          : input.state.lastSuccessfulLoad,
        consecutiveSameWeightMisses: input.result.metTargets ? 0 : nextMisses,
        lastAuthoritativeWeekIndex: input.weekIndex,
        checkpointWorthOverperformance,
        updatedAt: input.occurredAt,
      },
      "training-blocks.lp-updated-lift-state",
    ),
    summary,
    eventType,
  };
};

const updateExerciseLoad = (
  exercise: PlannedExercise,
  targetLoad: number,
  repScale = 1,
): PlannedExercise => ({
  ...exercise,
  plannedSets: exercise.plannedSets.map((plannedSet, index) =>
    index >= Math.ceil(exercise.plannedSets.length / 2) && repScale < 1
      ? {
          ...plannedSet,
          targetLoad,
          targetReps: Math.max(1, Math.round(plannedSet.targetReps * repScale)),
        }
      : {
          ...plannedSet,
          targetLoad,
          targetReps: Math.max(1, Math.round(plannedSet.targetReps * repScale)),
        },
  ),
});

const applyNextFourSessionDeload = (
  futureSessions: readonly PlannedSession[],
): readonly PlannedSession[] =>
  futureSessions.map((session, index) => {
    if (index >= 4) {
      return session;
    }

    return {
      ...session,
      sessionType: "deload",
      plannedExercises: session.plannedExercises.map((exercise) => ({
        ...exercise,
        plannedSets: exercise.plannedSets
          .slice(0, Math.max(1, Math.ceil(exercise.plannedSets.length / 2)))
          .map((plannedSet) => ({
            ...plannedSet,
            targetLoad: Number((plannedSet.targetLoad * 0.875).toFixed(2)),
            targetReps: Math.max(1, Math.round(plannedSet.targetReps * 0.65)),
            targetRpe: plannedSet.targetRpe === null ? 6 : Math.min(plannedSet.targetRpe, 6),
          })),
      })),
    };
  });

const updateFutureSessionsForLift = (input: {
  futureSessions: readonly PlannedSession[];
  triggerSession: PlannedSession;
  state: LpLiftProgressionState;
}): readonly PlannedSession[] => {
  const triggerPhase = getSessionPhase(input.triggerSession);

  if (triggerPhase === null) {
    return input.futureSessions;
  }

  return input.futureSessions.map((session) => {
    if (session.weekIndex <= input.triggerSession.weekIndex || getSessionPhase(session) !== triggerPhase) {
      return session;
    }

    const weeksAhead = session.weekIndex - input.triggerSession.weekIndex;
    const nextExpectedLoad = roundToUnitIncrement(
      (input.state.lastExpectedLoad ?? input.state.effectiveBaselineLoad) +
        getProgressionTierIncrement(input.state.unit, input.state.currentIncrementTier) * weeksAhead,
      input.state.unit,
    );

    return {
      ...session,
      plannedExercises: session.plannedExercises.map((exercise) =>
        exercise.liftSlug === input.state.liftSlug
          ? updateExerciseLoad(exercise, nextExpectedLoad)
          : exercise,
      ),
    };
  });
};

const checkpointBenchmarkTypeByCheckpointType: Record<LpCheckpointType, BenchmarkInput["benchmarkType"]> = {
  "five-rep-max": "five-rep-max",
  "three-rep-max": "three-rep-max",
  "two-rep-max": "one-rep-max",
};

export class LinearPeriodizationAdaptationService {
  constructor(private readonly repository: TrainingBlockRepository) {}

  async adaptCompletedSessionAsync(sessionId: string): Promise<void> {
    const [planSnapshot, trigger, baseRevision] = await Promise.all([
      this.repository.getActivePlanSnapshotAsync(),
      this.repository.getAdaptationTriggerAsync(sessionId),
      this.repository.getActivePlanSnapshotAsync().then(async (snapshot) =>
        snapshot === null ? null : this.repository.getLatestBlockRevisionAsync(snapshot.plan.block.id),
      ),
    ]);

    if (planSnapshot === null || trigger === null || baseRevision === null) {
      return;
    }

    const [programState, liftStates, goalProgress] = await Promise.all([
      this.repository.getLpProgramStateAsync(planSnapshot.plan.block.id),
      this.repository.getLpLiftProgressionStatesAsync(planSnapshot.plan.block.id),
      this.repository.getLpGoalProgressAsync(planSnapshot.plan.block.id),
    ]);

    if (programState === null || liftStates.length === 0) {
      return;
    }

    const now = trigger.workoutResult.completedAt;
    const triggerSession = trigger.completedSession;
    const triggerPhase = getSessionPhase(triggerSession);
    const sessionLiftResults = summarizeSessionLiftResults({
      session: triggerSession,
      loggedSetResults: trigger.loggedSetResults,
    });
    const liftStateBySlug = new Map(liftStates.map((state) => [state.liftSlug, state] as const));
    let updatedFutureSessions: readonly PlannedSession[] = [...planSnapshot.futureSessions];
    let updatedLiftStates = [...liftStates];
    let nextProgramState = programState;
    const checkpointResults: LpCheckpointResult[] = [];
    const nextGoalProgress = [...goalProgress];
    const mesocycleExtensions: LpMesocycleExtension[] = [];
    const adaptationEvents: AdaptationEvent[] = [];
    const explanationRecords: ExplanationRecord[] = [];

    if (triggerPhase !== null && !isCheckpointSession(triggerSession) && !isFinalTestSession(triggerSession)) {
      for (const result of sessionLiftResults) {
        if (
          !isAuthoritativeLiftResult({
            plan: planSnapshot.plan,
            triggerSession,
            liftSlug: result.liftSlug,
          })
        ) {
          continue;
        }

        const currentState = liftStateBySlug.get(result.liftSlug);

        if (currentState === undefined) {
          continue;
        }

        const { nextState, summary, eventType } = updateLiftStateFromWeeklyResult({
          state: currentState,
          result,
          weekIndex: triggerSession.weekIndex,
          phase: triggerPhase,
          occurredAt: now,
        });
        liftStateBySlug.set(result.liftSlug, nextState);
        updatedLiftStates = updatedLiftStates.map((state) =>
          state.liftSlug === result.liftSlug ? nextState : state,
        );
        updatedFutureSessions = updateFutureSessionsForLift({
          futureSessions: updatedFutureSessions,
          triggerSession,
          state: nextState,
        });

        if (nextState.consecutiveSameWeightMisses >= 2) {
          nextProgramState = parseWithSchema(
            lpProgramStateSchema,
            {
              ...nextProgramState,
              activeDeloadUntilSessionIndex:
                updatedFutureSessions.at(3)?.sessionIndex ?? updatedFutureSessions.at(-1)?.sessionIndex ?? null,
              updatedAt: now,
            },
            "training-blocks.lp-program-deload-state",
          );
          updatedFutureSessions = applyNextFourSessionDeload(updatedFutureSessions);
          const deloadEvent = createEvent({
            blockId: planSnapshot.plan.block.id,
            eventType: "deload-adjustment",
            reasonCode: "reactive-deload",
            summary: `${result.liftSlug} missed the same weight in back-to-back weekly check-ins, so the next 4 sessions were deloaded.`,
            triggeredAt: now,
          });
          adaptationEvents.push(deloadEvent);
          explanationRecords.push(
            createExplanation({
              ownerType: "adaptation-event",
              ownerId: deloadEvent.id,
              createdAt: now,
              headline: `${result.liftSlug} triggered a reactive deload`,
              body: deloadEvent.summary,
            }),
          );
        } else {
          const progressionEvent = createEvent({
            blockId: planSnapshot.plan.block.id,
            eventType,
            reasonCode: "weekly-progression",
            summary,
            triggeredAt: now,
          });
          adaptationEvents.push(progressionEvent);
          explanationRecords.push(
            createExplanation({
              ownerType: "adaptation-event",
              ownerId: progressionEvent.id,
              createdAt: now,
              headline: `${result.liftSlug} weekly progression updated`,
              body: summary,
            }),
          );
        }
      }
    } else if (isCheckpointSession(triggerSession) || isFinalTestSession(triggerSession)) {
      const checkpointType = checkpointTypeBySession(triggerSession);

      if (checkpointType !== null) {
        const updatedBenchmarks = planSnapshot.plan.sessions
          .flatMap((session) => session.plannedExercises)
          .reduce<Map<BenchmarkInput["liftSlug"], BenchmarkInput>>((current, exercise) => current, new Map());

        for (const liftState of updatedLiftStates) {
          updatedBenchmarks.set(liftState.liftSlug, {
            liftSlug: liftState.liftSlug,
            benchmarkType: "working-weight",
            value: liftState.lastSuccessfulLoad ?? liftState.effectiveBaselineLoad,
            unit: liftState.unit,
            notes: null,
          });
        }

        for (const result of sessionLiftResults) {
          const currentState = liftStateBySlug.get(result.liftSlug);

          if (currentState === undefined) {
            continue;
          }

          updatedBenchmarks.set(result.liftSlug, {
            liftSlug: result.liftSlug,
            benchmarkType: checkpointBenchmarkTypeByCheckpointType[checkpointType],
            value: result.actualLoad,
            unit: currentState.unit,
            notes: null,
          });

          const matchingGoal = nextGoalProgress.find((goal) => goal.liftSlug === result.liftSlug);
          const checkpointStatus =
            matchingGoal !== undefined && result.actualLoad >= matchingGoal.targetWeight
              ? "achieved"
              : result.actualLoad >= result.expectedLoad
                ? "on-track"
                : "behind";
          const checkpointResult = parseWithSchema(
            lpCheckpointResultSchema,
            {
              id: `checkpoint_${Math.random().toString(36).slice(2, 10)}`,
              blockId: planSnapshot.plan.block.id,
              sessionId: triggerSession.id,
              liftSlug: result.liftSlug,
              checkpointType,
              expectedLoad: result.expectedLoad,
              actualLoad: result.actualLoad,
              status: checkpointStatus,
              createdAt: now,
            },
            "training-blocks.lp-checkpoint-result",
          );
          checkpointResults.push(checkpointResult);

          if (matchingGoal !== undefined) {
            const updatedGoal = parseWithSchema(
              lpGoalProgressSchema,
              {
                ...matchingGoal,
                expectedCheckpointLoad: result.expectedLoad,
                actualCheckpointLoad: result.actualLoad,
                status:
                  result.actualLoad >= matchingGoal.targetWeight
                    ? "achieved"
                    : result.actualLoad >= result.expectedLoad
                      ? "on-track"
                      : "behind",
                remainingDelta: Math.max(
                  0,
                  Number((matchingGoal.targetWeight - result.actualLoad).toFixed(2)),
                ),
                updatedAt: now,
              },
              "training-blocks.lp-goal-progress-update",
            );
            const goalIndex = nextGoalProgress.findIndex((goal) => goal.id === matchingGoal.id);

            if (goalIndex >= 0) {
              nextGoalProgress[goalIndex] = updatedGoal;
            }
          }

          const recalibratedState = parseWithSchema(
            lpLiftProgressionStateSchema,
            {
              ...currentState,
              currentPhase:
                checkpointType === "five-rep-max"
                  ? "strength"
                  : checkpointType === "three-rep-max"
                    ? "taper"
                    : currentState.currentPhase,
              effectiveBaselineLoad: result.actualLoad,
              phaseEntryLoad: result.actualLoad,
              currentIncrementTier: "minimum",
              lastExpectedLoad: result.expectedLoad,
              lastLoggedLoad: result.actualLoad,
              lastSuccessfulLoad: result.actualLoad,
              consecutiveSameWeightMisses: 0,
              checkpointWorthOverperformance: false,
              updatedAt: now,
            },
            "training-blocks.lp-checkpoint-lift-state",
          );
          liftStateBySlug.set(result.liftSlug, recalibratedState);
          updatedLiftStates = updatedLiftStates.map((state) =>
            state.liftSlug === result.liftSlug ? recalibratedState : state,
          );
        }

        const programStructure = buildLpProgramStructure(programState.programLevel);
        let phaseInstancesOverride: GoalDrivenLpPhaseInstance[] = [];
        let revisionReason = "checkpoint-recalibration";
        let revisionSummary = `${checkpointType} checkpoint recalibrated the next LP phase.`;

        if (checkpointType === "five-rep-max") {
          phaseInstancesOverride = buildGoalDrivenLpPhaseInstances({
            programStructure,
            extraStrengthMesocycles: 0,
          }).filter((phase) => phase.phase !== "volume");
          nextProgramState = parseWithSchema(
            lpProgramStateSchema,
            {
              ...nextProgramState,
              currentPhase: "strength",
              nextCheckpointType: "three-rep-max",
              updatedAt: now,
            },
            "training-blocks.lp-program-phase-transition",
          );
        } else {
          const behindGoals = nextGoalProgress.filter((goal) => goal.status === "behind");

          if (behindGoals.length > 0) {
            const extensionPhases = buildGoalDrivenLpPhaseInstances({
              programStructure,
              extraStrengthMesocycles: 1,
            }).filter((phase) => phase.phase !== "volume");
            phaseInstancesOverride = extensionPhases;
            revisionReason = "goal-extension";
            revisionSummary = `A further strength mesocycle was added because ${behindGoals
              .map((goal) => goal.liftSlug)
              .join(", ")} is still behind the target path.`;
            const extension = parseWithSchema(
              lpMesocycleExtensionSchema,
              {
                id: `extension_${Math.random().toString(36).slice(2, 10)}`,
                blockId: planSnapshot.plan.block.id,
                triggeredByCheckpointResultId: checkpointResults[0]?.id ?? null,
                addedPhase: "strength",
                addedWeeks:
                  extensionPhases.filter((phase) => phase.phase === "strength").at(-1)?.durationWeeks ??
                  0,
                reason: revisionSummary,
                createdAt: now,
              },
              "training-blocks.lp-mesocycle-extension",
            );
            mesocycleExtensions.push(extension);
            nextProgramState = parseWithSchema(
              lpProgramStateSchema,
              {
                ...nextProgramState,
                currentPhase: "strength",
                currentMesocycleIndex: nextProgramState.currentMesocycleIndex + 1,
                nextCheckpointType: "three-rep-max",
                updatedAt: now,
              },
              "training-blocks.lp-program-extension-state",
            );
          } else if (checkpointType === "three-rep-max") {
            phaseInstancesOverride = buildGoalDrivenLpPhaseInstances({
              programStructure,
              extraStrengthMesocycles: 0,
            }).filter((phase) => phase.phase === "taper" || phase.phase === "final-test");
            nextProgramState = parseWithSchema(
              lpProgramStateSchema,
              {
                ...nextProgramState,
                currentPhase: "taper",
                nextCheckpointType: "two-rep-max",
                updatedAt: now,
              },
              "training-blocks.lp-program-taper-state",
            );
          } else {
            phaseInstancesOverride = [];
          }
        }

        const nextFutureStartDate =
          updatedFutureSessions[0]?.scheduledDate ?? triggerSession.scheduledDate;
        const nextPrimaryLiftSlug = triggerSession.plannedExercises[0]?.liftSlug;
        const regeneratedPlan =
          phaseInstancesOverride.length === 0
            ? null
            : generateGoalDrivenLpTrainingBlock(
                [...updatedBenchmarks.values()],
                {
                  startDate: nextFutureStartDate,
                  blockName: planSnapshot.plan.block.name,
                  goalSlug: planSnapshot.plan.block.goalSlug,
                  blockConfiguration:
                    planSnapshot.plan.block.blockConfiguration ?? {
                      schedulingPreferences: planSnapshot.plan.block.schedulingPreferences!,
                      durationWeeks: 4,
                      primaryGoal: "strength",
                      secondaryGoal: "hypertrophy",
                      benchmarkLiftSlugs: triggerSession.plannedExercises.map((exercise) => exercise.liftSlug),
                      primaryLiftsPerSession: 1,
                      secondaryLiftsPerSession: 1,
                      primaryLiftPool: triggerSession.plannedExercises.map((exercise) => exercise.liftSlug),
                      secondaryLiftPool: triggerSession.plannedExercises.map((exercise) => exercise.liftSlug),
                      targetLiftGoals: [],
                    },
                  phaseInstancesOverride,
                  generationVersion: `lp-revision-${checkpointType}`,
                  ...(nextPrimaryLiftSlug === undefined
                    ? {}
                    : { primaryLiftSlug: nextPrimaryLiftSlug }),
                },
              );

        updatedFutureSessions = regeneratedPlan?.sessions ?? [];
        const eventType =
          revisionReason === "goal-extension"
            ? "goal-extension"
            : checkpointType === "three-rep-max"
              ? "phase-transition"
              : "checkpoint-recalibration";
        const checkpointEvent = createEvent({
          blockId: planSnapshot.plan.block.id,
          eventType,
          reasonCode: revisionReason,
          summary: revisionSummary,
          triggeredAt: now,
        });
        adaptationEvents.push(checkpointEvent);
        explanationRecords.push(
          createExplanation({
            ownerType: "adaptation-event",
            ownerId: checkpointEvent.id,
            createdAt: now,
            headline:
              revisionReason === "goal-extension"
                ? "Strength phase extended toward the target goals"
                : `${checkpointType} checkpoint recalibrated the plan`,
            body: revisionSummary,
          }),
        );
      }
    }

    if (adaptationEvents.length === 0 && checkpointResults.length === 0) {
      return;
    }

    const revisionExplanation = createExplanation({
      ownerType: "block-revision",
      ownerId: baseRevision.id,
      createdAt: now,
      headline: "Plan adjusted from linear periodization feedback",
      body:
        adaptationEvents.at(-1)?.summary ??
        checkpointResults.at(-1)?.status ??
        "The future plan was updated from the latest completed session.",
    });
    explanationRecords.push(revisionExplanation);

    const persistableRevision: PersistableLpRevision = {
      blockId: planSnapshot.plan.block.id,
      triggeringSessionId: sessionId,
      revisionReason: adaptationEvents.at(-1)?.reasonCode ?? "lp-update",
      revisionSummary: adaptationEvents.at(-1)?.summary ?? "LP state updated.",
      updatedFutureSessions,
      programState: nextProgramState,
      liftStates: updatedLiftStates,
      checkpointResults,
      goalProgress: nextGoalProgress,
      mesocycleExtensions,
      adaptationEvents,
      explanationRecords,
    };

    await this.repository.persistLinearPeriodizationRevisionAsync(persistableRevision);
  }
}
