import { useMutation, useQueryClient } from "@tanstack/react-query";

import { useAppDatabase } from "@/database/AppDatabaseProvider";
import { TrainingBlockRepository } from "@/features/training-blocks/repository/TrainingBlockRepository";
import { queryKeys } from "@/query/queryKeys";

export const useQuickCompleteSessionMutation = (sessionId: string | null) => {
  const { repositoryContext } = useAppDatabase();
  const queryClient = useQueryClient();
  const repository = new TrainingBlockRepository(repositoryContext);

  return useMutation({
    mutationFn: async () => {
      if (sessionId === null) {
        throw new Error("[workouts] A session id is required to complete a workout.");
      }

      await repository.completeSessionAsPlannedAsync(sessionId);
    },
    onSuccess: async () => {
      if (sessionId === null) {
        return;
      }

      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: queryKeys.workouts.detail(sessionId),
        }),
        queryClient.invalidateQueries({
          queryKey: queryKeys.workouts.review(sessionId),
        }),
        queryClient.invalidateQueries({
          queryKey: queryKeys.workouts.history(),
        }),
        queryClient.invalidateQueries({
          queryKey: queryKeys.trainingBlocks.overview(),
        }),
        queryClient.invalidateQueries({
          queryKey: queryKeys.today.activeSession(),
        }),
        queryClient.invalidateQueries({
          queryKey: queryKeys.trainingBlocks.activePlan(),
        }),
        queryClient.invalidateQueries({
          queryKey: queryKeys.trainingBlocks.archivedPlans(),
        }),
      ]);
    },
  });
};
