import { ActivityIndicator, StyleSheet, Text, View } from "react-native";

import { appTheme } from "@/theme/appTheme";

type LoadingStateProps = {
  title: string;
  description: string;
};

export const LoadingState = ({ title, description }: LoadingStateProps) => {
  return (
    <View style={styles.container}>
      <ActivityIndicator color={appTheme.colors.accent} />
      <View style={styles.copy}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.description}>{description}</Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    gap: appTheme.spacing.md,
  },
  copy: {
    flex: 1,
    gap: 4,
  },
  title: {
    fontSize: 17,
    fontWeight: "700",
    color: appTheme.colors.textPrimary,
  },
  description: {
    fontSize: 14,
    lineHeight: 20,
    color: appTheme.colors.textSecondary,
  },
});
