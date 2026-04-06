import { useLocalSearchParams } from "expo-router";
import { Text } from "react-native";

import { PlaceholderScreen } from "@/components/navigation/PlaceholderScreen";
import { Button } from "@/components/ui";

const WorkoutDetailPlaceholderScreen = () => {
  const params = useLocalSearchParams<{ sessionId?: string }>();

  return (
    <PlaceholderScreen
      eyebrow="Workout Detail"
      title="Session detail is ready for the next slice"
      description="Today can now hand off into a dedicated workout route. The next issue will replace this placeholder with the full planned-session execution screen."
    >
      <Text>Session id: {params.sessionId ?? "unknown"}</Text>
      <Button label="Execution screen coming next" variant="secondary" />
    </PlaceholderScreen>
  );
};

export default WorkoutDetailPlaceholderScreen;
