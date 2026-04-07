import { useRouter } from "expo-router";
import { StyleSheet, Text, View } from "react-native";

import { Button, Card, EmptyState, ListRow, LoadingState, ScreenContainer } from "@/components/ui";
import { useTodaySessionQuery } from "@/features/training-blocks/queries/useTodaySessionQuery";
import { formatTrainingWeekday } from "@/features/training-blocks/services/blockSchedulingService";
import { appTheme } from "@/theme/appTheme";

const TodayScreen = () => {
  const router = useRouter();
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
  const scheduledWeekdayLabel =
    todaySession !== undefined && todaySession.state === "ready"
      ? formatTrainingWeekday(todaySession.scheduledWeekday)
      : null;

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
            action={
              <Button
                label="Open Blocks"
                onPress={() => {
                  router.push("/(tabs)/blocks");
                }}
                variant="secondary"
              />
            }
          />
        </Card>
      ) : (
        <>
          <Card>
            <View style={styles.heroHeader}>
              <Text style={styles.heroEyebrow}>Active Session</Text>
              <Text style={styles.heroTitle}>{todaySession.sessionTitle}</Text>
              <Text style={styles.heroDescription}>
                {todaySession.activeBlockName} is active now, and this session is ready to open in
                the workout detail flow.
              </Text>
            </View>
            <View style={styles.pillRow}>
              <View style={styles.pill}>
                <Text style={styles.pillLabel}>Date</Text>
                <Text style={styles.pillValue}>
                  {todaySession.scheduledDate}
                  {scheduledWeekdayLabel === null ? "" : ` • ${scheduledWeekdayLabel}`}
                </Text>
              </View>
              <View style={styles.pill}>
                <Text style={styles.pillLabel}>Type</Text>
                <Text style={styles.pillValue}>{todaySession.sessionType}</Text>
              </View>
              <View style={styles.pill}>
                <Text style={styles.pillLabel}>Session</Text>
                <Text style={styles.pillValue}>#{todaySession.sessionIndex}</Text>
              </View>
            </View>
            <Button
              label="Open workout detail"
              onPress={() => {
                router.push({
                  pathname: "/workouts/[sessionId]",
                  params: {
                    sessionId: todaySession.sessionId,
                  },
                });
              }}
            />
            <Button
              label="Open full block plan"
              onPress={() => {
                router.push("/plan");
              }}
              variant="secondary"
            />
          </Card>
          <Card>
            <ListRow
              title="Active block"
              description={todaySession.activeBlockName}
              trailing={todaySession.activeBlockGoal}
            />
            <ListRow
              title="Session structure"
              description={`${todaySession.exerciseCount} exercises across ${todaySession.plannedSetCount} planned sets.`}
              trailing={todaySession.sessionType}
            />
            <ListRow
              title="Execution handoff"
              description="Use the workout detail screen for the full planned exercise and set-by-set prescription."
              trailing="Ready"
            />
          </Card>
        </>
      )}
    </ScreenContainer>
  );
};

export default TodayScreen;

const styles = StyleSheet.create({
  heroHeader: {
    gap: appTheme.spacing.xs,
  },
  heroEyebrow: {
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 1.2,
    textTransform: "uppercase",
    color: appTheme.colors.accent,
  },
  heroTitle: {
    fontSize: 28,
    fontWeight: "800",
    color: appTheme.colors.textPrimary,
  },
  heroDescription: {
    fontSize: 15,
    lineHeight: 22,
    color: appTheme.colors.textSecondary,
  },
  pillRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: appTheme.spacing.sm,
  },
  pill: {
    minWidth: 92,
    gap: 4,
    borderRadius: appTheme.radius.md,
    paddingHorizontal: appTheme.spacing.md,
    paddingVertical: appTheme.spacing.sm,
    backgroundColor: appTheme.colors.surfaceMuted,
  },
  pillLabel: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1,
    textTransform: "uppercase",
    color: appTheme.colors.textMuted,
  },
  pillValue: {
    fontSize: 14,
    fontWeight: "700",
    color: appTheme.colors.textPrimary,
  },
});
