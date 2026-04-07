import { useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import { Button, Card, EmptyState, ListRow, LoadingState, ScreenContainer } from "@/components/ui";
import { useActiveLpPlanReviewQuery } from "@/features/training-blocks/queries/useActiveLpPlanReviewQuery";
import { useAdaptationSummariesQuery } from "@/features/training-blocks/queries/useAdaptationSummariesQuery";
import { useArchivedTrainingBlocksQuery } from "@/features/training-blocks/queries/useArchivedTrainingBlocksQuery";
import { useBlockOverviewQuery } from "@/features/training-blocks/queries/useBlockOverviewQuery";
import { formatTrainingWeekday } from "@/features/training-blocks/services/blockSchedulingService";
import { getSessionKindLabel, getSessionStatusLabel } from "@/features/training-blocks/services/sessionPresentation";
import { appTheme } from "@/theme/appTheme";

const BlockOverviewScreen = () => {
  const router = useRouter();
  const [selectedMonthKey, setSelectedMonthKey] = useState<string | null>(null);
  const blockOverviewQuery = useBlockOverviewQuery(selectedMonthKey);
  const archivedBlocksQuery = useArchivedTrainingBlocksQuery();
  const adaptationSummariesQuery = useAdaptationSummariesQuery();
  const lpPlanReviewQuery = useActiveLpPlanReviewQuery();

  if (
    blockOverviewQuery.isLoading ||
    archivedBlocksQuery.isLoading ||
    adaptationSummariesQuery.isLoading ||
    lpPlanReviewQuery.isLoading
  ) {
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
  const archivedBlocks = archivedBlocksQuery.data ?? [];
  const adaptationSummaries = adaptationSummariesQuery.data ?? [];
  const lpPlanReview = lpPlanReviewQuery.data ?? null;
  const availableMonths = overview?.availableMonths ?? [];
  const effectiveSelectedMonthKey = overview?.selectedMonthKey ?? null;
  const selectedMonthIndex = availableMonths.findIndex(
    (month) => month.key === effectiveSelectedMonthKey,
  );
  const selectedMonth = selectedMonthIndex === -1 ? null : (availableMonths[selectedMonthIndex] ?? null);
  const groupedWeeks = useMemo(() => {
    if (overview === null || overview === undefined) {
      return [];
    }

    const weeksMap = new Map<
      number,
      {
        weekIndex: number;
        sessions: {
          sessionId: string;
          title: string;
          scheduledDate: string;
          scheduledWeekdayLabel: string | null;
          sessionKindLabel: string;
          sessionStatusLabel: string;
          sessionType: string;
          status: string;
        }[];
      }
    >();

    overview.sessions.forEach((session) => {
      const nextSession = {
        sessionId: session.sessionId,
        title: session.title,
        scheduledDate: session.scheduledDate,
        scheduledWeekdayLabel: formatTrainingWeekday(session.scheduledWeekday),
        sessionKindLabel: getSessionKindLabel({ sessionType: session.sessionType }),
        sessionStatusLabel: getSessionStatusLabel({ status: session.status }),
        sessionType: session.sessionType,
        status: session.status,
      };
      const existingWeek = weeksMap.get(session.weekIndex);

      if (existingWeek === undefined) {
        weeksMap.set(session.weekIndex, {
          weekIndex: session.weekIndex,
          sessions: [nextSession],
        });
        return;
      }

      weeksMap.set(session.weekIndex, {
        weekIndex: existingWeek.weekIndex,
        sessions: [...existingWeek.sessions, nextSession],
      });
    });

    return [...weeksMap.values()].sort((left, right) => left.weekIndex - right.weekIndex);
  }, [overview]);

  return (
    <ScreenContainer
      eyebrow="Full Plan"
      title="Active block"
      description="Inspect the active block one month at a time, grouped by training week."
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
              {overview.durationWeeks !== null ? (
                <Text style={styles.blockMeta}>
                  {overview.durationWeeks} weeks • {overview.primaryGoal ?? "primary"} primary goal
                  • {overview.secondaryGoal ?? "secondary"} secondary goal
                </Text>
              ) : null}
              <Text style={styles.blockMeta}>
                {overview.trainingDaysPerWeek === null
                  ? "No saved schedule metadata"
                  : `${overview.trainingDaysPerWeek} training days per week on ${overview.selectedWeekdaysLabel ?? "saved weekdays"}`}
              </Text>
            </View>
          </Card>

          <Card>
            <View style={styles.weekHeader}>
              <Text style={styles.weekTitle}>Month view</Text>
              <Text style={styles.weekMeta}>
                {selectedMonth === null ? "No scheduled months" : `${selectedMonth.itemCount} sessions`}
              </Text>
            </View>
            <Text style={styles.blockMeta}>
              {selectedMonth === null
                ? "There are no scheduled sessions to browse yet."
                : `Showing ${selectedMonth.label}. Only sessions inside this month are loaded into the full-plan view.`}
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

          {lpPlanReview === null ? null : (
            <Card>
              <View style={styles.weekHeader}>
                <Text style={styles.weekTitle}>LP program state</Text>
                <Text style={styles.weekMeta}>{lpPlanReview.programLevel}</Text>
              </View>
              <Text style={styles.blockMeta}>
                Current phase: {lpPlanReview.currentPhase}.{" "}
                {lpPlanReview.nextCheckpointType === null
                  ? "No checkpoint is currently queued."
                  : `Next checkpoint: ${lpPlanReview.nextCheckpointType}.`}
              </Text>
              <Text style={styles.blockMeta}>
                {lpPlanReview.activeDeloadUntilSessionIndex === null
                  ? "No reactive deload is active."
                  : `Reactive deload active through session ${lpPlanReview.activeDeloadUntilSessionIndex}.`}
              </Text>
            </Card>
          )}

          {lpPlanReview === null ? null : (
            <Card>
              <View style={styles.weekHeader}>
                <Text style={styles.weekTitle}>Goal path</Text>
                <Text style={styles.weekMeta}>{lpPlanReview.goalProgress.length}</Text>
              </View>
              {lpPlanReview.goalProgress.length === 0 ? (
                <Text style={styles.blockMeta}>
                  No explicit target lift goals are saved for this program yet.
                </Text>
              ) : (
                lpPlanReview.goalProgress.map((goal) => (
                  <ListRow
                    key={goal.id}
                    title={`${goal.liftSlug} -> ${goal.targetWeight} ${goal.targetTestType}`}
                    description={
                      goal.actualCheckpointLoad === null
                        ? `Awaiting checkpoint comparison. Remaining delta: ${goal.remainingDelta.toFixed(2)}.`
                        : `Expected ${goal.expectedCheckpointLoad?.toFixed(2) ?? "-"}, actual ${goal.actualCheckpointLoad.toFixed(2)}, remaining delta ${goal.remainingDelta.toFixed(2)}.`
                    }
                    trailing={goal.status}
                  />
                ))
              )}
            </Card>
          )}

          {lpPlanReview !== null && lpPlanReview.mesocycleExtensions.length > 0 ? (
            <Card>
              <View style={styles.weekHeader}>
                <Text style={styles.weekTitle}>Added mesocycles</Text>
                <Text style={styles.weekMeta}>{lpPlanReview.mesocycleExtensions.length}</Text>
              </View>
              {lpPlanReview.mesocycleExtensions.map((extension) => (
                <ListRow
                  key={extension.id}
                  title={`${extension.addedPhase} +${extension.addedWeeks} weeks`}
                  description={`${extension.createdAt.slice(0, 10)}. ${extension.reason}`}
                />
              ))}
            </Card>
          ) : null}

          <Card>
            <View style={styles.weekHeader}>
              <Text style={styles.weekTitle}>Recent adaptations</Text>
              <Text style={styles.weekMeta}>{adaptationSummaries.length}</Text>
            </View>
            {adaptationSummaries.length === 0 ? (
              <Text style={styles.blockMeta}>
                No completed session has changed the LP plan yet. Checkpoint recalibrations,
                reactive deloads, and added mesocycles will appear here once they happen.
              </Text>
            ) : (
              adaptationSummaries.map((adaptationSummary) => (
                <View key={adaptationSummary.eventId} style={styles.adaptationItem}>
                  <ListRow
                    title={adaptationSummary.headline}
                    description={`${adaptationSummary.triggeredAt.slice(0, 10)} • ${adaptationSummary.reasonCode}`}
                    trailing={adaptationSummary.eventType.replace("-", " ")}
                  />
                  <Text style={styles.adaptationBody}>{adaptationSummary.body}</Text>
                  {adaptationSummary.revisionBody === null ? null : (
                    <Text style={styles.adaptationMeta}>{adaptationSummary.revisionBody}</Text>
                  )}
                </View>
              ))
            )}
          </Card>

          {groupedWeeks.map((week) => (
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
                      <View
                        style={[
                          styles.pill,
                          session.sessionType === "benchmark"
                            ? styles.benchmarkPill
                            : session.sessionType === "final-test"
                              ? styles.finalTestPill
                              : session.status === "completed"
                                ? styles.donePill
                                : session.status === "skipped"
                                  ? styles.missedPill
                                  : styles.plannedPill,
                        ]}
                      >
                        <Text style={styles.statusPillText}>{session.sessionStatusLabel}</Text>
                      </View>
                    </View>
                  }
                />
              ))}
            </Card>
          ))}

          <Card>
            <View style={styles.weekHeader}>
              <Text style={styles.weekTitle}>Archived blocks</Text>
              <Text style={styles.weekMeta}>{archivedBlocks.length}</Text>
            </View>
            {archivedBlocks.length === 0 ? (
              <Text style={styles.blockMeta}>
                Regeneration has not archived any prior blocks yet. Once setup changes replace the
                current block, the previous block will stay reviewable here.
              </Text>
            ) : (
              archivedBlocks.map((archivedBlock) => (
                <ListRow
                  key={archivedBlock.blockId}
                  title={archivedBlock.blockName}
                  description={`${archivedBlock.startDate} to ${archivedBlock.endDate}. ${archivedBlock.completedSessions}/${archivedBlock.totalSessions} sessions completed.${archivedBlock.latestRevisionSummary === null ? "" : ` ${archivedBlock.latestRevisionSummary}`}`}
                  trailing={`${archivedBlock.benchmarkSessionCount} benchmark / ${archivedBlock.finalTestSessionCount} final test`}
                />
              ))
            )}
          </Card>
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
  adaptationItem: {
    gap: appTheme.spacing.xs,
  },
  adaptationBody: {
    fontSize: 14,
    lineHeight: 21,
    color: appTheme.colors.textPrimary,
  },
  adaptationMeta: {
    fontSize: 13,
    lineHeight: 20,
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
  monthNavigationRow: {
    flexDirection: "row",
    gap: appTheme.spacing.sm,
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
  benchmarkPill: {
    backgroundColor: "#f1e2b8",
  },
  finalTestPill: {
    backgroundColor: "#d9e3f1",
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
