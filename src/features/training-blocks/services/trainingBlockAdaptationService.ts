import type { TrainingBlockRepository } from "@/features/training-blocks/repository/TrainingBlockRepository";
import { LinearPeriodizationAdaptationService } from "@/features/training-blocks/services/linearPeriodizationAdaptationService";

export class TrainingBlockAdaptationService {
  constructor(private readonly repository: TrainingBlockRepository) {}

  async adaptCompletedSessionAsync(sessionId: string): Promise<void> {
    const adaptationService = new LinearPeriodizationAdaptationService(this.repository);
    await adaptationService.adaptCompletedSessionAsync(sessionId);
  }
}
