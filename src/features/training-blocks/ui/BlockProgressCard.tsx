import { StyleSheet, Text, View } from "react-native";

import { Card, EmptyState, ListRow, LoadingState } from "@/components/ui";
import { useBlockProgressQuery } from "@/features/training-blocks/queries/useBlockProgressQuery";
import { appTheme } from "@/theme/appTheme";

export const BlockProgressCard = () => {
  const blockProgressQuery = useBlockProgressQuery();

  if (blockProgressQuery.isLoading) {
    return (
      <Card>
        <LoadingState
          title="Loading block progress"
          description="Summarizing completed and remaining sessions from the active local block."
        />
      </Card>
    );
  }

  const progress = blockProgressQuery.data;

  if (progress === undefined || progress.state !== "ready") {
    return (
      <Card>
        <EmptyState
          title="No active block progress yet"
          description={
            progress?.message ??
            "Generate an active block first to unlock the local progress summary."
          }
        />
      </Card>
    );
  }

  return (
    <Card>
      <View style={styles.header}>
        <Text style={styles.title}>Block progress</Text>
        <Text style={styles.description}>
          {progress.blockName} is currently tracking {progress.completedSessions} completed sessions
          with {progress.remainingSessions} still remaining.
        </Text>
      </View>
      <View style={styles.metricsRow}>
        <View style={styles.metric}>
          <Text style={styles.metricLabel}>Completed</Text>
          <Text style={styles.metricValue}>{progress.completedSessions}</Text>
        </View>
        <View style={styles.metric}>
          <Text style={styles.metricLabel}>Remaining</Text>
          <Text style={styles.metricValue}>{progress.remainingSessions}</Text>
        </View>
        <View style={styles.metric}>
          <Text style={styles.metricLabel}>Current week</Text>
          <Text style={styles.metricValue}>{progress.currentWeek ?? "-"}</Text>
        </View>
      </View>
      <ListRow
        title="Deload week"
        description="The planned deload stays visible so block position is easy to understand."
        trailing={progress.deloadWeek ?? "None"}
      />
      <ListRow
        title="Recent completions"
        description={
          progress.completedSessionTitles.length > 0
            ? progress.completedSessionTitles.join(", ")
            : "No sessions completed yet."
        }
      />
      <ListRow
        title="Upcoming sessions"
        description={
          progress.upcomingSessionTitles.length > 0
            ? progress.upcomingSessionTitles.join(", ")
            : "No sessions remain in the current block."
        }
      />
    </Card>
  );
};

const styles = StyleSheet.create({
  header: {
    gap: appTheme.spacing.xs,
  },
  title: {
    fontSize: 20,
    fontWeight: "800",
    color: appTheme.colors.textPrimary,
  },
  description: {
    fontSize: 14,
    lineHeight: 21,
    color: appTheme.colors.textSecondary,
  },
  metricsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: appTheme.spacing.sm,
  },
  metric: {
    minWidth: 96,
    gap: 4,
    borderRadius: appTheme.radius.md,
    paddingHorizontal: appTheme.spacing.md,
    paddingVertical: appTheme.spacing.sm,
    backgroundColor: appTheme.colors.surfaceMuted,
  },
  metricLabel: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1,
    textTransform: "uppercase",
    color: appTheme.colors.textMuted,
  },
  metricValue: {
    fontSize: 18,
    fontWeight: "800",
    color: appTheme.colors.textPrimary,
  },
});
