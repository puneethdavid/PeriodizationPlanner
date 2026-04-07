import { useMutation, useQueryClient } from "@tanstack/react-query";

import { useAppDatabase } from "@/database/AppDatabaseProvider";
import { TrainingBlockRepository } from "@/features/training-blocks/repository/TrainingBlockRepository";
import { TrainingBlockAdaptationService } from "@/features/training-blocks/services/trainingBlockAdaptationService";
import { queryKeys } from "@/query/queryKeys";

type AdjustedSessionResultsInput = {
  sessionId: string;
  completionStatus: "completed" | "partial" | "missed";
  setResults: readonly {
    plannedSetId: string;
    setIndex: number;
    actualReps: number | null;
    actualLoad: number | null;
    actualRpe: number | null;
    isCompleted: boolean;
  }[];
};

export const useSaveAdjustedSessionResultsMutation = (sessionId: string | null) => {
  const { repositoryContext } = useAppDatabase();
  const queryClient = useQueryClient();
  const repository = new TrainingBlockRepository(repositoryContext);
  const adaptationService = new TrainingBlockAdaptationService(repository);

  return useMutation({
    mutationFn: async (input: AdjustedSessionResultsInput) => {
      await repository.saveAdjustedSessionResultsAsync(input);
      await adaptationService.adaptCompletedSessionAsync(input.sessionId);
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
          queryKey: queryKeys.trainingBlocks.adaptationSummaries(),
        }),
        queryClient.invalidateQueries({
          queryKey: queryKeys.trainingBlocks.archivedPlans(),
        }),
      ]);
    },
  });
};
