import { useMutation, useQueryClient } from "@tanstack/react-query";

import { useAppDatabase } from "@/database/AppDatabaseProvider";
import { TrainingBlockRepository } from "@/features/training-blocks/repository/TrainingBlockRepository";
import type { BlockSchedulingPreferences } from "@/features/training-blocks/schema/trainingBlockSchemas";
import { queryKeys } from "@/query/queryKeys";

export const useSaveBlockSchedulingPreferencesMutation = () => {
  const { repositoryContext } = useAppDatabase();
  const queryClient = useQueryClient();
  const repository = new TrainingBlockRepository(repositoryContext);

  return useMutation({
    mutationFn: async (input: BlockSchedulingPreferences) => {
      return repository.saveBlockSchedulingPreferencesAsync(input);
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: queryKeys.trainingBlocks.setupPreferences(),
        }),
        queryClient.invalidateQueries({
          queryKey: queryKeys.trainingBlocks.activePlan(),
        }),
      ]);
    },
  });
};
