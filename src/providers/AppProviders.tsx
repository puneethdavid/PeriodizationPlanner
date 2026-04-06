import type { PropsWithChildren } from "react";

import { QueryClientProvider } from "@tanstack/react-query";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { AppDatabaseProvider } from "@/database/AppDatabaseProvider";
import { AppThemeProvider } from "@/providers/AppThemeProvider";
import { queryClient } from "@/query/queryClient";

export const AppProviders = ({ children }: PropsWithChildren) => {
  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <AppThemeProvider>
          <AppDatabaseProvider>{children}</AppDatabaseProvider>
        </AppThemeProvider>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
};
