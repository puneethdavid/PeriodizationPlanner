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
      description="Capture saved benchmark inputs first, then review the setup and generate the local training block from those values."
    >
      <BenchmarkEntryCard />
      <BlockScheduleSetupCard />
      <BlockGenerationCard />
      <BlockProgressCard />
      <Card>
        <Text style={{ color: appTheme.colors.textSecondary, lineHeight: 22 }}>
          Saved benchmark inputs seed generation. Benchmark and final-test sessions inside the plan
          are later scheduled workouts, not the same thing as the setup values saved here.
        </Text>
      </Card>
    </ScreenContainer>
  );
};

export default BlocksScreen;
