import type { ReactNode } from "react";

import { Pressable, StyleSheet, Text, View } from "react-native";

import { appTheme } from "@/theme/appTheme";

type ListRowProps = {
  title: string;
  description?: string;
  trailing?: ReactNode;
  onPress?: () => void;
};

export const ListRow = ({ title, description, trailing, onPress }: ListRowProps) => {
  const content = (
    <>
      <View style={styles.copy}>
        <Text style={styles.title}>{title}</Text>
        {description !== undefined ? <Text style={styles.description}>{description}</Text> : null}
      </View>
      {trailing !== undefined ? <View>{trailing}</View> : null}
    </>
  );

  if (onPress === undefined) {
    return <View style={styles.row}>{content}</View>;
  }

  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.row, pressed ? styles.pressed : null]}>
      {content}
    </Pressable>
  );
};

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: appTheme.spacing.md,
    paddingVertical: appTheme.spacing.sm,
  },
  pressed: {
    opacity: 0.88,
  },
  copy: {
    flex: 1,
    gap: 4,
  },
  title: {
    fontSize: 16,
    fontWeight: "700",
    color: appTheme.colors.textPrimary,
  },
  description: {
    fontSize: 14,
    lineHeight: 20,
    color: appTheme.colors.textSecondary,
  },
});
