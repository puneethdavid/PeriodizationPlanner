import { useQuery } from "@tanstack/react-query";

import { useAppDatabase } from "@/database/AppDatabaseProvider";
import { TrainingBlockRepository } from "@/features/training-blocks/repository/TrainingBlockRepository";
import { buildBlockProgressQueryModel } from "@/features/training-blocks/services/blockProgressQueryModel";
import { queryKeys } from "@/query/queryKeys";

export const useBlockProgressQuery = () => {
  const { repositoryContext } = useAppDatabase();
  const repository = new TrainingBlockRepository(repositoryContext);

  return useQuery({
    queryKey: [...queryKeys.trainingBlocks.all, "progress"] as const,
    queryFn: async () => {
      const activePlan = await repository.getActiveTrainingBlockAsync();
      return buildBlockProgressQueryModel(activePlan);
    },
  });
};
