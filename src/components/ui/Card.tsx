import type { PropsWithChildren } from "react";

import { StyleSheet, View } from "react-native";

import { appTheme } from "@/theme/appTheme";

export const Card = ({ children }: PropsWithChildren) => {
  return <View style={styles.card}>{children}</View>;
};

const styles = StyleSheet.create({
  card: {
    gap: appTheme.spacing.md,
    borderWidth: 1,
    borderColor: appTheme.colors.border,
    borderRadius: appTheme.radius.xl,
    padding: appTheme.spacing.lg,
    backgroundColor: appTheme.colors.surface,
  },
});
