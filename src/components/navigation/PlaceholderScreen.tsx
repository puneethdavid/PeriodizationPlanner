import type { PropsWithChildren } from "react";

import { StatusBar } from "expo-status-bar";
import { Text } from "react-native";

import { Card, ScreenContainer } from "@/components/ui";
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
    <ScreenContainer eyebrow={eyebrow} title={title} description={description}>
      <Card>
        <Text style={styles.eyebrow}>{eyebrow}</Text>
        <Text style={styles.description}>{description}</Text>
        {children}
      </Card>
      <StatusBar style="dark" />
    </ScreenContainer>
  );
};

const styles = {
  eyebrow: {
    fontSize: 13,
    fontWeight: "700",
    letterSpacing: 1.4,
    textTransform: "uppercase",
    color: appTheme.colors.accent,
  },
  description: {
    fontSize: 16,
    lineHeight: 24,
    color: appTheme.colors.textSecondary,
  },
} as const;
