import { Text } from "react-native";

import { Card, ScreenContainer } from "@/components/ui";
import { BenchmarkEntryCard } from "@/features/training-blocks/ui/BenchmarkEntryCard";
import { appTheme } from "@/theme/appTheme";

const BlocksScreen = () => {
  return (
    <ScreenContainer
      eyebrow="Planning"
      title="Blocks"
      description="Capture starting benchmarks first, then generate and review the local training block from those saved values."
    >
      <BenchmarkEntryCard />
      <Card>
        <Text style={{ color: appTheme.colors.textSecondary, lineHeight: 22 }}>
          The next step will use these saved benchmarks to generate one active local training
          block.
        </Text>
      </Card>
    </ScreenContainer>
  );
};

export default BlocksScreen;
