import { StatusBar } from "expo-status-bar";
import { StyleSheet, Text, View } from "react-native";

import { appTheme } from "@/theme/appTheme";

const App = () => {
  return (
    <View style={styles.container}>
      <Text style={styles.eyebrow}>Foundation Ready</Text>
      <Text style={styles.title}>Periodization Planner</Text>
      <Text style={styles.description}>
        TypeScript strict mode, linting, and formatting are configured so we can build the mobile
        app on a clean baseline.
      </Text>
      <StatusBar style="dark" />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
    backgroundColor: appTheme.colors.background,
  },
  eyebrow: {
    marginBottom: 12,
    fontSize: 14,
    fontWeight: "700",
    letterSpacing: 1.8,
    textTransform: "uppercase",
    color: appTheme.colors.accent,
  },
  title: {
    marginBottom: 12,
    fontSize: 32,
    fontWeight: "800",
    textAlign: "center",
    color: appTheme.colors.textPrimary,
  },
  description: {
    maxWidth: 320,
    fontSize: 16,
    lineHeight: 24,
    textAlign: "center",
    color: appTheme.colors.textSecondary,
  },
});

export default App;
