import type { TrainingBlockRepository } from "@/features/training-blocks/repository/TrainingBlockRepository";
import type { GeneratedTrainingPlan } from "@/features/training-blocks/schema/trainingBlockSchemas";
import type { FixedBlockGeneratorOptions } from "@/features/training-blocks/services/fixedBlockGenerator";

export class TrainingBlockCreationService {
  constructor(private readonly repository: TrainingBlockRepository) {}

  async createActiveTrainingBlockAsync(
    options: FixedBlockGeneratorOptions,
  ): Promise<GeneratedTrainingPlan> {
    return this.repository.createActiveTrainingBlockFromSavedBenchmarksAsync(options);
  }

  async getActiveTrainingBlockAsync(): Promise<GeneratedTrainingPlan | null> {
    return this.repository.getActiveTrainingBlockAsync();
  }
}
