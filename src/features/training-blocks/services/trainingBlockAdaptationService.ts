import type { TrainingBlockRepository } from "@/features/training-blocks/repository/TrainingBlockRepository";
import { AdaptationEngineService } from "@/features/training-blocks/services/adaptationEngineService";
import { evaluateAdaptationSignals } from "@/features/training-blocks/services/adaptationHeuristics";
import { buildUpdatedFutureSessions } from "@/features/training-blocks/services/adaptationRevisionBuilder";
import { applyAdaptationRules } from "@/features/training-blocks/services/adaptationRules";

export class TrainingBlockAdaptationService {
  constructor(private readonly repository: TrainingBlockRepository) {}

  async adaptCompletedSessionAsync(sessionId: string): Promise<void> {
    const adaptationEngineService = new AdaptationEngineService({
      store: this.repository,
      writer: this.repository,
      evaluateSignals: (input) =>
        evaluateAdaptationSignals({
          trigger: input.trigger,
          recentWorkoutReviews: input.planSnapshot.completedWorkoutReviews,
        }),
      applyRules: (input) =>
        applyAdaptationRules({
          futureSessions: input.planSnapshot.futureSessions,
          adaptationSignals: input.adaptationSignals,
        }),
      buildUpdatedFutureSessions,
    });

    await adaptationEngineService.applyRevisionForCompletedSessionAsync(sessionId);
  }
}
