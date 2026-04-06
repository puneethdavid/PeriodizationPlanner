import type { PropsWithChildren } from "react";

import { ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { appTheme } from "@/theme/appTheme";

type ScreenContainerProps = PropsWithChildren<{
  eyebrow?: string;
  title: string;
  description?: string;
}>;

export const ScreenContainer = ({
  children,
  eyebrow,
  title,
  description,
}: ScreenContainerProps) => {
  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          {eyebrow !== undefined ? <Text style={styles.eyebrow}>{eyebrow}</Text> : null}
          <Text style={styles.title}>{title}</Text>
          {description !== undefined ? <Text style={styles.description}>{description}</Text> : null}
        </View>
        <View style={styles.body}>{children}</View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: appTheme.colors.background,
  },
  content: {
    padding: appTheme.spacing.lg,
    gap: appTheme.spacing.lg,
  },
  header: {
    gap: appTheme.spacing.xs,
  },
  eyebrow: {
    fontSize: 13,
    fontWeight: "700",
    letterSpacing: 1.4,
    textTransform: "uppercase",
    color: appTheme.colors.accent,
  },
  title: {
    fontSize: 30,
    fontWeight: "800",
    color: appTheme.colors.textPrimary,
  },
  description: {
    fontSize: 16,
    lineHeight: 24,
    color: appTheme.colors.textSecondary,
  },
  body: {
    gap: appTheme.spacing.md,
  },
});
