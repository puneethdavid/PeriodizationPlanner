import { Button, Card, ListRow, ScreenContainer } from "@/components/ui";

const TodayScreen = () => {
  return (
    <ScreenContainer
      eyebrow="Daily Focus"
      title="Today"
      description="Session execution, readiness prompts, and the next prescribed work will land here."
    >
      <Card>
        <ListRow
          title="Next session"
          description="Lower-body strength session with benchmark-aware starting loads."
          trailing="38 min"
        />
        <ListRow
          title="Readiness check"
          description="Sleep, bodyweight, and readiness inputs will shape adjustments here."
          trailing="2 prompts"
        />
        <Button label="Start planned session" />
      </Card>
    </ScreenContainer>
  );
};

export default TodayScreen;
