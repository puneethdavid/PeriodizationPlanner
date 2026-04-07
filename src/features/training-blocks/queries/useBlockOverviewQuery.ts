import { useQuery } from "@tanstack/react-query";

import { useAppDatabase } from "@/database/AppDatabaseProvider";
import { TrainingBlockRepository } from "@/features/training-blocks/repository/TrainingBlockRepository";
import { buildBlockOverviewQueryModel } from "@/features/training-blocks/services/blockOverviewQueryModel";
import { queryKeys } from "@/query/queryKeys";

export const useBlockOverviewQuery = () => {
  const { repositoryContext } = useAppDatabase();
  const repository = new TrainingBlockRepository(repositoryContext);

  return useQuery({
    queryKey: queryKeys.trainingBlocks.overview(),
    queryFn: async () => {
      const activePlan = await repository.getActiveTrainingBlockAsync();
      return buildBlockOverviewQueryModel(activePlan);
    },
  });
};
