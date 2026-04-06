import { Button, Card, EmptyState, ScreenContainer } from "@/components/ui";

const HistoryScreen = () => {
  return (
    <ScreenContainer
      eyebrow="Review"
      title="History"
      description="Completed sessions, trend review, and adaptation signals will be collected here."
    >
      <Card>
        <EmptyState
          title="No completed sessions yet"
          description="This empty state gives future history and stats screens a reusable baseline for first-run experiences."
          action={<Button label="Browse upcoming block" variant="secondary" />}
        />
      </Card>
    </ScreenContainer>
  );
};

export default HistoryScreen;
