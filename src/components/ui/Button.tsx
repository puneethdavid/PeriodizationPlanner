import type { ComponentProps } from "react";

import { Pressable, StyleSheet, Text } from "react-native";

import { appTheme } from "@/theme/appTheme";

type ButtonVariant = "primary" | "secondary";

type ButtonProps = ComponentProps<typeof Pressable> & {
  label: string;
  variant?: ButtonVariant;
};

export const Button = ({ label, variant = "primary", ...pressableProps }: ButtonProps) => {
  return (
    <Pressable
      accessibilityRole="button"
      style={({ pressed }) => [
        styles.base,
        variant === "secondary" ? styles.secondary : styles.primary,
        pressed ? styles.pressed : null,
      ]}
      {...pressableProps}
    >
      <Text style={[styles.label, variant === "secondary" ? styles.secondaryLabel : null]}>
        {label}
      </Text>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  base: {
    minHeight: 52,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: appTheme.radius.lg,
    paddingHorizontal: appTheme.spacing.lg,
  },
  primary: {
    backgroundColor: appTheme.colors.accent,
  },
  secondary: {
    borderWidth: 1,
    borderColor: appTheme.colors.border,
    backgroundColor: appTheme.colors.surfaceMuted,
  },
  pressed: {
    opacity: 0.88,
  },
  label: {
    fontSize: 16,
    fontWeight: "700",
    color: appTheme.colors.buttonText,
  },
  secondaryLabel: {
    color: appTheme.colors.textPrimary,
  },
});
