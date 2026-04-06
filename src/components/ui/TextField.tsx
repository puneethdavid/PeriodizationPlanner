import type { ComponentProps } from "react";

import { StyleSheet, Text, TextInput, View } from "react-native";

import { appTheme } from "@/theme/appTheme";

type TextFieldProps = ComponentProps<typeof TextInput> & {
  label: string;
  helperText?: string;
};

export const TextField = ({ label, helperText, ...inputProps }: TextFieldProps) => {
  return (
    <View style={styles.wrapper}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        placeholderTextColor={appTheme.colors.textMuted}
        style={styles.input}
        {...inputProps}
      />
      {helperText !== undefined ? <Text style={styles.helperText}>{helperText}</Text> : null}
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    gap: appTheme.spacing.xs,
  },
  label: {
    fontSize: 14,
    fontWeight: "700",
    color: appTheme.colors.textPrimary,
  },
  input: {
    minHeight: 50,
    borderWidth: 1,
    borderColor: appTheme.colors.border,
    borderRadius: appTheme.radius.md,
    paddingHorizontal: appTheme.spacing.md,
    paddingVertical: appTheme.spacing.sm,
    backgroundColor: appTheme.colors.surface,
    color: appTheme.colors.textPrimary,
  },
  helperText: {
    fontSize: 13,
    color: appTheme.colors.textMuted,
  },
});
