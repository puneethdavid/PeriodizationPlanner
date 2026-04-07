import { Text } from "react-native";

import { Card, ScreenContainer } from "@/components/ui";
import { BenchmarkEntryCard } from "@/features/training-blocks/ui/BenchmarkEntryCard";
import { BlockGenerationCard } from "@/features/training-blocks/ui/BlockGenerationCard";
import { BlockProgressCard } from "@/features/training-blocks/ui/BlockProgressCard";
import { BlockScheduleSetupCard } from "@/features/training-blocks/ui/BlockScheduleSetupCard";
import { appTheme } from "@/theme/appTheme";

const BlocksScreen = () => {
  return (
    <ScreenContainer
      eyebrow="Planning"
      title="Blocks"
      description="Capture starting benchmarks first, then generate and review the local training block from those saved values."
    >
      <BenchmarkEntryCard />
      <BlockScheduleSetupCard />
      <BlockGenerationCard />
      <BlockProgressCard />
      <Card>
        <Text style={{ color: appTheme.colors.textSecondary, lineHeight: 22 }}>
          The active block is created locally from the saved benchmark set and then handed off to
          the Today route for execution.
        </Text>
      </Card>
    </ScreenContainer>
  );
};

export default BlocksScreen;
