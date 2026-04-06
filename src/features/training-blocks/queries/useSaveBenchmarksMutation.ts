import { useMutation, useQueryClient } from "@tanstack/react-query";

import { useAppDatabase } from "@/database/AppDatabaseProvider";
import type { BenchmarkInput } from "@/features/training-blocks/schema/trainingBlockSchemas";
import { TrainingBlockRepository } from "@/features/training-blocks/repository/TrainingBlockRepository";
import { queryKeys } from "@/query/queryKeys";

export const useSaveBenchmarksMutation = () => {
  const { repositoryContext } = useAppDatabase();
  const queryClient = useQueryClient();
  const repository = new TrainingBlockRepository(repositoryContext);

  return useMutation({
    mutationFn: (inputs: readonly BenchmarkInput[]) => repository.saveBenchmarksAsync(inputs),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: queryKeys.trainingBlocks.benchmarks(),
      });
    },
  });
};
