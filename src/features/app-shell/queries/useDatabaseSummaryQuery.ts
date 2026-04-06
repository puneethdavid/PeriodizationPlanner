import { useQuery } from "@tanstack/react-query";

import { useAppDatabase } from "@/database/AppDatabaseProvider";
import { AppShellRepository } from "@/features/app-shell/repository/AppShellRepository";
import { queryKeys } from "@/query/queryKeys";

export const useDatabaseSummaryQuery = () => {
  const { repositoryContext } = useAppDatabase();
  const repository = new AppShellRepository(repositoryContext);

  return useQuery({
    queryKey: queryKeys.appShell.databaseSummary(),
    queryFn: () => repository.getDatabaseSummaryAsync(),
  });
};
