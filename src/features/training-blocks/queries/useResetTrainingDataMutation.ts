import { useMutation, useQueryClient } from "@tanstack/react-query";

import { useAppDatabase } from "@/database/AppDatabaseProvider";
import { TrainingBlockRepository } from "@/features/training-blocks/repository/TrainingBlockRepository";
import { queryKeys } from "@/query/queryKeys";

export const useResetTrainingDataMutation = () => {
  const { repositoryContext } = useAppDatabase();
  const queryClient = useQueryClient();
  const repository = new TrainingBlockRepository(repositoryContext);

  return useMutation({
    mutationFn: async () => {
      await repository.resetTrainingBlockDataAsync();
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: queryKeys.trainingBlocks.all,
        }),
        queryClient.invalidateQueries({
          queryKey: queryKeys.today.all,
        }),
        queryClient.invalidateQueries({
          queryKey: queryKeys.workouts.all,
        }),
      ]);
    },
  });
};
