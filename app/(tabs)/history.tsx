import { useRouter } from "expo-router";

import { Button, Card, EmptyState, ListRow, LoadingState, ScreenContainer } from "@/components/ui";
import { useCompletedSessionHistoryQuery } from "@/features/training-blocks/queries/useCompletedSessionHistoryQuery";

const HistoryScreen = () => {
  const router = useRouter();
  const completedSessionHistoryQuery = useCompletedSessionHistoryQuery();

  if (completedSessionHistoryQuery.isLoading) {
    return (
      <ScreenContainer
        eyebrow="Review"
        title="History"
        description="Completed sessions, trend review, and adaptation signals will be collected here."
      >
        <Card>
          <LoadingState
            title="Loading session history"
            description="Reading completed local workout data and recent execution summaries."
          />
        </Card>
      </ScreenContainer>
    );
  }

  const completedSessions = completedSessionHistoryQuery.data ?? [];

  return (
    <ScreenContainer
      eyebrow="Review"
      title="History"
      description="Completed sessions, trend review, and adaptation signals will be collected here."
    >
      {completedSessions.length === 0 ? (
        <Card>
          <EmptyState
            title="No completed sessions yet"
            description="Complete or log a workout from the Today flow to start building local history."
            action={
              <Button
                label="Browse upcoming block"
                onPress={() => {
                  router.push("/(tabs)/today");
                }}
                variant="secondary"
              />
            }
          />
        </Card>
      ) : (
        <Card>
          {completedSessions.map((session) => (
            <ListRow
              key={session.sessionId}
              title={session.title}
              description={`${session.exerciseCount} exercises, ${session.plannedSetCount} sets, completed ${session.completedAt.slice(0, 10)}`}
              trailing={session.completionStatus}
            />
          ))}
        </Card>
      )}
    </ScreenContainer>
  );
};

export default HistoryScreen;
