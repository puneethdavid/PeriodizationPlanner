import type { PlannedSession } from "@/features/training-blocks/schema/trainingBlockSchemas";
import type {
  AdaptationEvaluationContext,
  AdaptationPlanReadStore,
  AdaptationPlanWriteStore,
  AdaptationRuleResult,
  PersistedAdaptationRevision,
  ProposedPlanRevision,
} from "@/features/training-blocks/services/adaptationEngineContracts";

type AdaptationEngineDependencies = {
  store: AdaptationPlanReadStore;
  writer: AdaptationPlanWriteStore;
  evaluateSignals: (input: AdaptationEvaluationContext) => AdaptationRuleResult["adaptationSignals"];
  applyRules: (input: AdaptationEvaluationContext & {
    adaptationSignals: AdaptationRuleResult["adaptationSignals"];
  }) => AdaptationRuleResult;
  buildUpdatedFutureSessions: (input: {
    futureSessions: readonly PlannedSession[];
    proposedRevision: ProposedPlanRevision;
  }) => readonly PlannedSession[];
};

export class AdaptationEngineService {
  constructor(private readonly dependencies: AdaptationEngineDependencies) {}

  async proposeRevisionForCompletedSessionAsync(
    sessionId: string,
  ): Promise<ProposedPlanRevision | null> {
    const [planSnapshot, adaptationTrigger] = await Promise.all([
      this.dependencies.store.getActivePlanSnapshotAsync(),
      this.dependencies.store.getAdaptationTriggerAsync(sessionId),
    ]);

    if (planSnapshot === null || adaptationTrigger === null) {
      return null;
    }

    const baseRevision = await this.dependencies.store.getLatestBlockRevisionAsync(
      planSnapshot.plan.block.id,
    );

    if (baseRevision === null) {
      throw new Error(
        `[adaptation-engine] Active block ${planSnapshot.plan.block.id} is missing a base revision.`,
      );
    }

    const evaluationContext: AdaptationEvaluationContext = {
      planSnapshot,
      trigger: adaptationTrigger,
      baseRevision,
    };

    const adaptationSignals = this.dependencies.evaluateSignals(evaluationContext);

    const ruleResult = this.dependencies.applyRules({
      ...evaluationContext,
      adaptationSignals,
    });

    return {
      blockId: planSnapshot.plan.block.id,
      baseRevision,
      nextRevisionNumber: baseRevision.revisionNumber + 1,
      reason: ruleResult.reason,
      summary: ruleResult.summary,
      triggeringSessionId: adaptationTrigger.sessionId,
      proposedSessionAdjustments: ruleResult.proposedSessionAdjustments,
      adaptationSignals: ruleResult.adaptationSignals,
    };
  }

  async applyRevisionForCompletedSessionAsync(
    sessionId: string,
  ): Promise<PersistedAdaptationRevision | null> {
    const [planSnapshot, proposedRevision] = await Promise.all([
      this.dependencies.store.getActivePlanSnapshotAsync(),
      this.proposeRevisionForCompletedSessionAsync(sessionId),
    ]);

    if (planSnapshot === null || proposedRevision === null) {
      return null;
    }

    const updatedFutureSessions = this.dependencies.buildUpdatedFutureSessions({
      futureSessions: planSnapshot.futureSessions,
      proposedRevision,
    });

    return this.dependencies.writer.persistAdaptationRevisionAsync(
      proposedRevision,
      updatedFutureSessions,
    );
  }
}
