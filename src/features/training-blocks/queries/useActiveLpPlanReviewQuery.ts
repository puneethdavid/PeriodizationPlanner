import { useQuery } from "@tanstack/react-query";

import { useAppDatabase } from "@/database/AppDatabaseProvider";
import { TrainingBlockRepository } from "@/features/training-blocks/repository/TrainingBlockRepository";
import { queryKeys } from "@/query/queryKeys";

export const useActiveLpPlanReviewQuery = () => {
  const { repositoryContext } = useAppDatabase();
  const repository = new TrainingBlockRepository(repositoryContext);

  return useQuery({
    queryKey: queryKeys.trainingBlocks.lpReview(),
    queryFn: () => repository.getActiveLpPlanReviewAsync(),
  });
};
