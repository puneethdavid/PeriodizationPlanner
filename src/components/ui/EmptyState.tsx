import type { ReactNode } from "react";

import { StyleSheet, Text, View } from "react-native";

import { appTheme } from "@/theme/appTheme";

type EmptyStateProps = {
  title: string;
  description: string;
  action?: ReactNode;
};

export const EmptyState = ({ title, description, action }: EmptyStateProps) => {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.description}>{description}</Text>
      {action !== undefined ? <View style={styles.action}>{action}</View> : null}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: "flex-start",
    gap: appTheme.spacing.sm,
  },
  title: {
    fontSize: 18,
    fontWeight: "700",
    color: appTheme.colors.textPrimary,
  },
  description: {
    fontSize: 15,
    lineHeight: 22,
    color: appTheme.colors.textSecondary,
  },
  action: {
    marginTop: appTheme.spacing.xs,
    width: "100%",
  },
});
