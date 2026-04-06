import { Text, View } from "react-native";

import { PlaceholderScreen } from "@/components/navigation/PlaceholderScreen";
import { runtimeConfig } from "@/config/runtimeConfig";
import { appTheme } from "@/theme/appTheme";

const SettingsScreen = () => {
  return (
    <PlaceholderScreen
      eyebrow="Profile"
      title="Settings"
      description="Profile preferences, app configuration, and future sync controls will live here."
    >
      <View style={{ marginTop: 18, gap: 8 }}>
        <Text style={{ color: appTheme.colors.textPrimary, fontWeight: "700" }}>
          Runtime environment: {runtimeConfig.appEnv}
        </Text>
        <Text style={{ color: appTheme.colors.textSecondary }}>
          Supabase: {runtimeConfig.supabase.url === null ? "not configured" : "configured"}
        </Text>
        <Text style={{ color: appTheme.colors.textSecondary }}>
          Notifications:{" "}
          {runtimeConfig.notifications.projectId === null ? "not configured" : "configured"}
        </Text>
      </View>
    </PlaceholderScreen>
  );
};

export default SettingsScreen;
