import { useQuery } from "@tanstack/react-query";

import { useAppDatabase } from "@/database/AppDatabaseProvider";
import { TrainingBlockRepository } from "@/features/training-blocks/repository/TrainingBlockRepository";
import { buildTodaySessionQueryModel } from "@/features/training-blocks/services/todaySessionQueryModel";
import { queryKeys } from "@/query/queryKeys";

export const useTodaySessionQuery = () => {
  const { repositoryContext } = useAppDatabase();
  const repository = new TrainingBlockRepository(repositoryContext);

  return useQuery({
    queryKey: queryKeys.today.activeSession(),
    queryFn: async () => {
      const activePlan = await repository.getActiveTrainingBlockAsync();
      return buildTodaySessionQueryModel(activePlan);
    },
  });
};
