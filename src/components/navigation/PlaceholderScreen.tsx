import type { PropsWithChildren } from "react";

import { StatusBar } from "expo-status-bar";
import { StyleSheet, Text, View } from "react-native";

import { appTheme } from "@/theme/appTheme";

type PlaceholderScreenProps = PropsWithChildren<{
  eyebrow: string;
  title: string;
  description: string;
}>;

export const PlaceholderScreen = ({
  eyebrow,
  title,
  description,
  children,
}: PlaceholderScreenProps) => {
  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.eyebrow}>{eyebrow}</Text>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.description}>{description}</Text>
        {children}
      </View>
      <StatusBar style="dark" />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: 20,
    backgroundColor: appTheme.colors.background,
  },
  card: {
    borderWidth: 1,
    borderColor: appTheme.colors.border,
    borderRadius: 28,
    padding: 24,
    backgroundColor: appTheme.colors.surface,
  },
  eyebrow: {
    marginBottom: 10,
    fontSize: 13,
    fontWeight: "700",
    letterSpacing: 1.4,
    textTransform: "uppercase",
    color: appTheme.colors.accent,
  },
  title: {
    marginBottom: 12,
    fontSize: 30,
    fontWeight: "800",
    color: appTheme.colors.textPrimary,
  },
  description: {
    fontSize: 16,
    lineHeight: 24,
    color: appTheme.colors.textSecondary,
  },
});
