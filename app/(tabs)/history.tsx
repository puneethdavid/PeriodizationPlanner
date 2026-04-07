import { useRouter } from "expo-router";
import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import { Button, Card, EmptyState, ListRow, LoadingState, ScreenContainer } from "@/components/ui";
import { useCompletedSessionHistoryQuery } from "@/features/training-blocks/queries/useCompletedSessionHistoryQuery";
import { getSessionKindLabel } from "@/features/training-blocks/services/sessionPresentation";
import { appTheme } from "@/theme/appTheme";

const HistoryScreen = () => {
  const router = useRouter();
  const [selectedMonthKey, setSelectedMonthKey] = useState<string | null>(null);
  const completedSessionHistoryQuery = useCompletedSessionHistoryQuery(selectedMonthKey);

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

  const historyOverview = completedSessionHistoryQuery.data;
  const completedSessions = historyOverview?.sessions ?? [];
  const availableMonths = historyOverview?.availableMonths ?? [];
  const effectiveSelectedMonthKey = historyOverview?.selectedMonthKey ?? null;
  const selectedMonthIndex = availableMonths.findIndex(
    (month) => month.key === effectiveSelectedMonthKey,
  );
  const selectedMonth = selectedMonthIndex === -1 ? null : (availableMonths[selectedMonthIndex] ?? null);

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
        <>
          <Card>
            <View style={styles.monthHeader}>
              <Text style={styles.monthTitle}>Month review</Text>
              <Text style={styles.monthMeta}>
                {selectedMonth === null ? "No history yet" : `${selectedMonth.itemCount} sessions`}
              </Text>
            </View>
            <Text style={styles.monthDescription}>
              {selectedMonth === null
                ? "Completed sessions will appear here once you log workouts."
                : `Showing ${selectedMonth.label}. The history screen only loads completed sessions from the selected month.`}
            </Text>
            <View style={styles.monthNavigationRow}>
              <Button
                disabled={selectedMonthIndex <= 0}
                label="Previous month"
                onPress={() => {
                  if (selectedMonthIndex <= 0) {
                    return;
                  }

                  setSelectedMonthKey(availableMonths[selectedMonthIndex - 1]?.key ?? null);
                }}
                variant="secondary"
              />
              <Button
                disabled={selectedMonthIndex === -1 || selectedMonthIndex >= availableMonths.length - 1}
                label="Next month"
                onPress={() => {
                  if (selectedMonthIndex === -1 || selectedMonthIndex >= availableMonths.length - 1) {
                    return;
                  }

                  setSelectedMonthKey(availableMonths[selectedMonthIndex + 1]?.key ?? null);
                }}
                variant="secondary"
              />
            </View>
          </Card>
          <Card>
            {completedSessions.map((session) => (
              <ListRow
                key={session.sessionId}
                title={session.title}
                description={`${getSessionKindLabel({ sessionType: session.sessionType })} result in ${session.blockName}${session.blockStatus === "archived" ? " (archived block)" : ""}. ${session.exerciseCount} exercises, ${session.plannedSetCount} sets, completed ${session.completedAt.slice(0, 10)}.`}
                onPress={() => {
                  router.push({
                    pathname: "/workouts/[sessionId]",
                    params: {
                      sessionId: session.sessionId,
                    },
                  });
                }}
                trailing={getSessionKindLabel({ sessionType: session.sessionType })}
              />
            ))}
          </Card>
        </>
      )}
    </ScreenContainer>
  );
};

export default HistoryScreen;

const styles = StyleSheet.create({
  monthHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  monthTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: appTheme.colors.textPrimary,
  },
  monthMeta: {
    fontSize: 13,
    color: appTheme.colors.textSecondary,
  },
  monthDescription: {
    fontSize: 14,
    lineHeight: 21,
    color: appTheme.colors.textSecondary,
  },
  monthNavigationRow: {
    flexDirection: "row",
    gap: appTheme.spacing.sm,
  },
});
