import { Button, Card, EmptyState, ListRow, LoadingState, ScreenContainer } from "@/components/ui";
import { useTodaySessionQuery } from "@/features/training-blocks/queries/useTodaySessionQuery";

const TodayScreen = () => {
  const todaySessionQuery = useTodaySessionQuery();

  if (todaySessionQuery.isLoading) {
    return (
      <ScreenContainer
        eyebrow="Daily Focus"
        title="Today"
        description="Session execution, readiness prompts, and the next prescribed work will land here."
      >
        <Card>
          <LoadingState
            title="Loading active plan"
            description="Checking local training data for the current active block and next planned session."
          />
        </Card>
      </ScreenContainer>
    );
  }

  const todaySession = todaySessionQuery.data;

  return (
    <ScreenContainer
      eyebrow="Daily Focus"
      title="Today"
      description="Session execution, readiness prompts, and the next prescribed work will land here."
    >
      {todaySession === undefined || todaySession.state !== "ready" ? (
        <Card>
          <EmptyState
            title={
              todaySession?.state === "no-session-scheduled"
                ? "No scheduled session"
                : "No active block yet"
            }
            description={
              todaySession?.message ??
              "Generate a block from saved benchmarks on the Blocks tab to populate the Today flow."
            }
          />
        </Card>
      ) : (
        <Card>
          <ListRow
            title="Active block"
            description={todaySession.activeBlockName}
            trailing={todaySession.activeBlockGoal}
          />
          <ListRow
            title="Next session"
            description={todaySession.sessionTitle}
            trailing={todaySession.scheduledDate}
          />
          <ListRow
            title="Session details"
            description={`${todaySession.exerciseCount} exercises across ${todaySession.plannedSetCount} planned sets.`}
            trailing={`#${todaySession.sessionIndex}`}
          />
          <Button label="Start planned session" />
        </Card>
      )}
    </ScreenContainer>
  );
};

export default TodayScreen;
