import { Text, View } from "react-native";

import { Button, Card, ListRow, ScreenContainer } from "@/components/ui";
import { runtimeConfig } from "@/config/runtimeConfig";
import { useAppDatabase } from "@/database/AppDatabaseProvider";
import { useDatabaseSummaryQuery } from "@/features/app-shell/queries/useDatabaseSummaryQuery";
import { appTheme } from "@/theme/appTheme";

const SettingsScreen = () => {
  const { schemaVersion } = useAppDatabase();
  const databaseSummaryQuery = useDatabaseSummaryQuery();

  return (
    <ScreenContainer
      eyebrow="Profile"
      title="Settings"
      description="Profile preferences, app configuration, and future sync controls will live here."
    >
      <Card>
        <View style={{ gap: 8 }}>
          <ListRow
            title="Runtime environment"
            description="Validated through the shared config module."
            trailing={<Text>{runtimeConfig.appEnv}</Text>}
          />
          <ListRow
            title="Supabase"
            description="Future sync adapter configuration."
            trailing={
              <Text>{runtimeConfig.supabase.url === null ? "not configured" : "configured"}</Text>
            }
          />
          <ListRow
            title="Notifications"
            description="Future reminder and prompt setup."
            trailing={
              <Text>
                {runtimeConfig.notifications.projectId === null ? "not configured" : "configured"}
              </Text>
            }
          />
          <ListRow
            title="Schema version"
            description="Latest migration version known to the app shell."
            trailing={<Text>{schemaVersion}</Text>}
          />
          <ListRow
            title="Applied migrations"
            description="Sample TanStack Query read from the local repository layer."
            trailing={<Text>{databaseSummaryQuery.data?.migrationCount ?? "loading"}</Text>}
          />
        </View>
        <Text style={{ color: appTheme.colors.textSecondary }}>
          Database path: {databaseSummaryQuery.data?.databasePath ?? "loading"}
        </Text>
        <Button label="Review sync readiness" variant="secondary" />
      </Card>
    </ScreenContainer>
  );
};

export default SettingsScreen;
