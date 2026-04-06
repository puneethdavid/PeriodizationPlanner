import { Button, Card, EmptyState, ListRow, LoadingState, ScreenContainer } from "@/components/ui";
import { useActiveTrainingBlockQuery } from "@/features/training-blocks/queries/useActiveTrainingBlockQuery";

const TodayScreen = () => {
  const activeTrainingBlockQuery = useActiveTrainingBlockQuery();

  if (activeTrainingBlockQuery.isLoading) {
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

  const activePlan = activeTrainingBlockQuery.data;
  const nextSession = activePlan?.sessions[0];

  return (
    <ScreenContainer
      eyebrow="Daily Focus"
      title="Today"
      description="Session execution, readiness prompts, and the next prescribed work will land here."
    >
      {activePlan === null || activePlan === undefined ? (
        <Card>
          <EmptyState
            title="No active block yet"
            description="Generate a block from saved benchmarks on the Blocks tab to populate the Today flow."
          />
        </Card>
      ) : (
        <Card>
          <ListRow
            title="Active block"
            description={activePlan.block.name}
            trailing={`${activePlan.sessions.length} sessions`}
          />
          <ListRow
            title="Next session"
            description={nextSession?.title ?? "No session is scheduled yet."}
            trailing={nextSession?.scheduledDate ?? "Pending"}
          />
          <ListRow
            title="Plan basis"
            description="Generated locally from the saved benchmark set."
            trailing={activePlan.block.goalSlug}
          />
          <Button label="Start planned session" />
        </Card>
      )}
    </ScreenContainer>
  );
};

export default TodayScreen;
