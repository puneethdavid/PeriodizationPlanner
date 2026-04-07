import { useQuery } from "@tanstack/react-query";

import { useAppDatabase } from "@/database/AppDatabaseProvider";
import { TrainingBlockRepository } from "@/features/training-blocks/repository/TrainingBlockRepository";
import { queryKeys } from "@/query/queryKeys";

export const useCompletedWorkoutDetailQuery = (sessionId: string | null) => {
  const { repositoryContext } = useAppDatabase();
  const repository = new TrainingBlockRepository(repositoryContext);

  return useQuery({
    queryKey: queryKeys.workouts.review(sessionId ?? "missing"),
    queryFn: () => {
      if (sessionId === null) {
        return Promise.resolve(null);
      }

      return repository.getWorkoutSessionReviewAsync(sessionId);
    },
    enabled: sessionId !== null,
  });
};
