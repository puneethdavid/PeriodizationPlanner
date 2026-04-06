import { Stack } from "expo-router";

import { AppProviders } from "@/providers/AppProviders";

const RootLayout = () => {
  return (
    <AppProviders>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" />
      </Stack>
    </AppProviders>
  );
};

export default RootLayout;
