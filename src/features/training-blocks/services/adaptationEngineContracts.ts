import type {
  BlockRevision,
  GeneratedTrainingPlan,
  LoggedSetResult,
  PlannedSession,
  WorkoutResult,
} from "@/features/training-blocks/schema/trainingBlockSchemas";

export type AdaptationConfidence = "low" | "medium" | "high";

export type AdaptationTrigger = {
  sessionId: string;
  completedSession: PlannedSession;
  workoutResult: WorkoutResult;
  loggedSetResults: readonly LoggedSetResult[];
};

export type AdaptationWorkoutReview = {
  session: PlannedSession;
  workoutResult: WorkoutResult;
  loggedSetResults: readonly LoggedSetResult[];
};

export type AdaptationPlanSnapshot = {
  plan: GeneratedTrainingPlan;
  completedSessions: readonly PlannedSession[];
  completedWorkoutReviews: readonly AdaptationWorkoutReview[];
  futureSessions: readonly PlannedSession[];
};

export type AdaptationEvaluationContext = {
  planSnapshot: AdaptationPlanSnapshot;
  trigger: AdaptationTrigger;
  baseRevision: BlockRevision;
};

export type AdaptationSignal =
  | {
      signalType: "progression-opportunity";
      liftSlug: string;
      direction: "increase";
      confidence: AdaptationConfidence;
      reason: string;
    }
  | {
      signalType: "stalled-performance";
      liftSlug: string;
      direction: "hold";
      confidence: AdaptationConfidence;
      reason: string;
    }
  | {
      signalType: "deload-needed";
      liftSlug: string;
      direction: "decrease";
      confidence: Extract<AdaptationConfidence, "medium" | "high">;
      reason: string;
    };

export type ProposedSetAdjustment = {
  plannedSetId: string;
  targetLoad: number;
  targetReps: number;
  targetRpe: number | null;
};

export type ProposedSessionAdjustment = {
  sessionId: string;
  reasonCode: string;
  summary: string;
  setAdjustments: readonly ProposedSetAdjustment[];
};

export type ProposedPlanRevision = {
  blockId: string;
  baseRevision: BlockRevision;
  nextRevisionNumber: number;
  reason: string;
  summary: string;
  triggeringSessionId: string;
  proposedSessionAdjustments: readonly ProposedSessionAdjustment[];
  adaptationSignals: readonly AdaptationSignal[];
};

export type AdaptationRuleResult = {
  adaptationSignals: readonly AdaptationSignal[];
  proposedSessionAdjustments: readonly ProposedSessionAdjustment[];
  reason: string;
  summary: string;
};

export type PersistedAdaptationRevision = {
  revision: BlockRevision;
  updatedFutureSessions: readonly PlannedSession[];
};

export interface AdaptationPlanReadStore {
  getActivePlanSnapshotAsync(): Promise<AdaptationPlanSnapshot | null>;
  getAdaptationTriggerAsync(sessionId: string): Promise<AdaptationTrigger | null>;
  getLatestBlockRevisionAsync(blockId: string): Promise<BlockRevision | null>;
}

export interface AdaptationPlanWriteStore {
  persistAdaptationRevisionAsync(
    proposedRevision: ProposedPlanRevision,
    updatedFutureSessions: readonly PlannedSession[],
  ): Promise<PersistedAdaptationRevision>;
}

export type AdaptationPlanStore = AdaptationPlanReadStore & AdaptationPlanWriteStore;
