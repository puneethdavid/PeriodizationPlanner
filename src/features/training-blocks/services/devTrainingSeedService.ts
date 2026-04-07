import type { TrainingBlockRepository } from "@/features/training-blocks/repository/TrainingBlockRepository";
import type { GeneratedTrainingPlan } from "@/features/training-blocks/schema/trainingBlockSchemas";

import { starterBenchmarkFixture } from "@/features/training-blocks/fixtures/trainingFixtures";
import { createDefaultBlockSchedulingPreferences } from "@/features/training-blocks/services/blockSchedulingService";
import { TrainingBlockCreationService } from "@/features/training-blocks/services/trainingBlockCreationService";

const assertDevelopmentOnly = (): void => {
  if (!__DEV__) {
    throw new Error("[training-blocks.dev-seed] Development seed helpers are disabled in production.");
  }
};

export class DevTrainingSeedService {
  private readonly creationService: TrainingBlockCreationService;

  constructor(private readonly repository: TrainingBlockRepository) {
    this.creationService = new TrainingBlockCreationService(repository);
  }

  async seedStarterTrainingDataAsync(startDate = "2026-04-13"): Promise<GeneratedTrainingPlan> {
    assertDevelopmentOnly();

    await this.repository.resetTrainingBlockDataAsync();
    await this.repository.saveBlockSchedulingPreferencesAsync(
      createDefaultBlockSchedulingPreferences(),
    );
    await this.repository.saveBenchmarksAsync(starterBenchmarkFixture);

    return this.creationService.createActiveTrainingBlockAsync({
      startDate,
      blockName: "Starter Strength Block",
      goalSlug: "general-strength",
      primaryLiftSlug: "back-squat",
    });
  }

  async resetTrainingDataAsync(): Promise<void> {
    assertDevelopmentOnly();
    await this.repository.resetTrainingBlockDataAsync();
  }
}
