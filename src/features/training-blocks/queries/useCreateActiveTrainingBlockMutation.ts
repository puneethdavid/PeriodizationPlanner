import { useMutation, useQueryClient } from "@tanstack/react-query";

import { useAppDatabase } from "@/database/AppDatabaseProvider";
import { TrainingBlockRepository } from "@/features/training-blocks/repository/TrainingBlockRepository";
import { TrainingBlockCreationService } from "@/features/training-blocks/services/trainingBlockCreationService";
import { queryKeys } from "@/query/queryKeys";

const getTodayIsoDate = (): string => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

export const useCreateActiveTrainingBlockMutation = () => {
  const { repositoryContext } = useAppDatabase();
  const queryClient = useQueryClient();
  const repository = new TrainingBlockRepository(repositoryContext);
  const creationService = new TrainingBlockCreationService(repository);

  return useMutation({
    mutationFn: () =>
      creationService.createActiveTrainingBlockAsync({
        startDate: getTodayIsoDate(),
        blockName: "Starter Strength Block",
        goalSlug: "general-strength",
        primaryLiftSlug: "back-squat",
      }),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: queryKeys.trainingBlocks.configuration(),
        }),
        queryClient.invalidateQueries({
          queryKey: queryKeys.trainingBlocks.overview(),
        }),
        queryClient.invalidateQueries({
          queryKey: queryKeys.trainingBlocks.activePlan(),
        }),
        queryClient.invalidateQueries({
          queryKey: queryKeys.trainingBlocks.setupPreferences(),
        }),
        queryClient.invalidateQueries({
          queryKey: queryKeys.trainingBlocks.benchmarks(),
        }),
        queryClient.invalidateQueries({
          queryKey: queryKeys.today.activeSession(),
        }),
      ]);
    },
  });
};
