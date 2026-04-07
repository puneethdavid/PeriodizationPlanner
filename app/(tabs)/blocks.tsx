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
      description="Set up the block first, then capture benchmarks for the selected primary lifts and generate the local plan."
    >
      <BlockScheduleSetupCard />
      <BenchmarkEntryCard />
      <BlockGenerationCard />
      <BlockProgressCard />
      <Card>
        <Text style={{ color: appTheme.colors.textSecondary, lineHeight: 22 }}>
          Primary lift choices now drive which benchmarks and target goals are available. The
          benchmark values saved here seed generation, while benchmark and final-test sessions in
          the plan are later scheduled workouts.
        </Text>
      </Card>
    </ScreenContainer>
  );
};

export default BlocksScreen;
