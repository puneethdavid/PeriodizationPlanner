import { useRouter } from "expo-router";
import { StyleSheet, Text, View } from "react-native";

import { Button, Card, EmptyState, ListRow, LoadingState, ScreenContainer } from "@/components/ui";
import { useBlockOverviewQuery } from "@/features/training-blocks/queries/useBlockOverviewQuery";
import { appTheme } from "@/theme/appTheme";

const BlockOverviewScreen = () => {
  const router = useRouter();
  const blockOverviewQuery = useBlockOverviewQuery();

  if (blockOverviewQuery.isLoading) {
    return (
      <ScreenContainer
        eyebrow="Full Plan"
        title="Active block"
        description="Inspect the full generated plan, grouped by training week."
      >
        <Card>
          <LoadingState
            title="Loading active block"
            description="Reading the full generated block and scheduled sessions from local storage."
          />
        </Card>
      </ScreenContainer>
    );
  }

  const overview = blockOverviewQuery.data;

  return (
    <ScreenContainer
      eyebrow="Full Plan"
      title="Active block"
      description="Inspect the full generated plan, grouped by training week."
    >
      {overview === null || overview === undefined ? (
        <Card>
          <EmptyState
            title="No active block yet"
            description="Generate a block on the Blocks tab before opening the full plan overview."
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
            <View style={styles.header}>
              <Text style={styles.blockName}>{overview.blockName}</Text>
              <Text style={styles.blockMeta}>
                {overview.startDate} to {overview.endDate}
              </Text>
              <Text style={styles.blockMeta}>
                {overview.trainingDaysPerWeek === null
                  ? "No saved schedule metadata"
                  : `${overview.trainingDaysPerWeek} training days per week on ${overview.selectedWeekdaysLabel ?? "saved weekdays"}`}
              </Text>
            </View>
          </Card>

          {overview.weeks.map((week) => (
            <Card key={week.weekIndex}>
              <View style={styles.weekHeader}>
                <Text style={styles.weekTitle}>Week {week.weekIndex}</Text>
                <Text style={styles.weekMeta}>{week.sessions.length} sessions</Text>
              </View>
              {week.sessions.map((session) => (
                <ListRow
                  key={session.sessionId}
                  title={session.title}
                  description={`${session.scheduledDate}${session.scheduledWeekdayLabel === null ? "" : ` • ${session.scheduledWeekdayLabel}`}`}
                  onPress={() => {
                    router.push({
                      pathname: "/workouts/[sessionId]",
                      params: {
                        sessionId: session.sessionId,
                      },
                    });
                  }}
                  trailing={
                    <View style={styles.trailingColumn}>
                      <View style={[styles.pill, styles.kindPill]}>
                        <Text style={styles.kindPillText}>{session.sessionKindLabel}</Text>
                      </View>
                      <View style={[styles.pill, session.status === "completed" ? styles.donePill : session.status === "skipped" ? styles.missedPill : styles.plannedPill]}>
                        <Text style={styles.statusPillText}>{session.sessionStatusLabel}</Text>
                      </View>
                    </View>
                  }
                />
              ))}
            </Card>
          ))}
        </>
      )}
    </ScreenContainer>
  );
};

export default BlockOverviewScreen;

const styles = StyleSheet.create({
  header: {
    gap: appTheme.spacing.xs,
  },
  blockName: {
    fontSize: 24,
    fontWeight: "800",
    color: appTheme.colors.textPrimary,
  },
  blockMeta: {
    fontSize: 14,
    lineHeight: 21,
    color: appTheme.colors.textSecondary,
  },
  weekHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  weekTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: appTheme.colors.textPrimary,
  },
  weekMeta: {
    fontSize: 13,
    color: appTheme.colors.textSecondary,
  },
  trailingColumn: {
    alignItems: "flex-end",
    gap: appTheme.spacing.xs,
  },
  pill: {
    borderRadius: 999,
    paddingHorizontal: appTheme.spacing.sm,
    paddingVertical: 6,
  },
  kindPill: {
    backgroundColor: appTheme.colors.surfaceMuted,
  },
  kindPillText: {
    fontSize: 11,
    fontWeight: "700",
    color: appTheme.colors.textPrimary,
    textTransform: "uppercase",
  },
  plannedPill: {
    backgroundColor: appTheme.colors.surfaceMuted,
  },
  donePill: {
    backgroundColor: "#d6ead6",
  },
  missedPill: {
    backgroundColor: "#edd8d4",
  },
  statusPillText: {
    fontSize: 11,
    fontWeight: "700",
    color: appTheme.colors.textPrimary,
    textTransform: "uppercase",
  },
});
