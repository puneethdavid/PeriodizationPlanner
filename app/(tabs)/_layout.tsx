import { Tabs } from "expo-router";

import { appTheme } from "@/theme/appTheme";

const TabsLayout = () => {
  return (
    <Tabs
      screenOptions={{
        headerStyle: {
          backgroundColor: appTheme.colors.surface,
        },
        headerTintColor: appTheme.colors.textPrimary,
        tabBarActiveTintColor: appTheme.colors.accent,
        tabBarInactiveTintColor: appTheme.colors.textMuted,
        tabBarStyle: {
          backgroundColor: appTheme.colors.surface,
          borderTopColor: appTheme.colors.border,
        },
        sceneStyle: {
          backgroundColor: appTheme.colors.background,
        },
      }}
    >
      <Tabs.Screen name="today" options={{ title: "Today" }} />
      <Tabs.Screen name="blocks" options={{ title: "Blocks" }} />
      <Tabs.Screen name="history" options={{ title: "History" }} />
      <Tabs.Screen name="settings" options={{ title: "Settings" }} />
    </Tabs>
  );
};

export default TabsLayout;
