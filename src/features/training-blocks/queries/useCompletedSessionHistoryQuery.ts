import { useQuery } from "@tanstack/react-query";

import { useAppDatabase } from "@/database/AppDatabaseProvider";
import { TrainingBlockRepository } from "@/features/training-blocks/repository/TrainingBlockRepository";
import { queryKeys } from "@/query/queryKeys";

export const useCompletedSessionHistoryQuery = (monthKey?: string | null) => {
  const { repositoryContext } = useAppDatabase();
  const repository = new TrainingBlockRepository(repositoryContext);

  return useQuery({
    queryKey: queryKeys.workouts.history(monthKey ?? undefined),
    queryFn: () => repository.getCompletedSessionHistoryByMonthAsync(monthKey),
  });
};
