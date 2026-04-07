import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import {
  Button,
  Card,
  EmptyState,
  ListRow,
  LoadingState,
  NumberField,
  ScreenContainer,
} from "@/components/ui";
import { useCompletedWorkoutDetailQuery } from "@/features/training-blocks/queries/useCompletedWorkoutDetailQuery";
import { useQuickCompleteSessionMutation } from "@/features/training-blocks/queries/useQuickCompleteSessionMutation";
import { useSaveAdjustedSessionResultsMutation } from "@/features/training-blocks/queries/useSaveAdjustedSessionResultsMutation";
import { formatTrainingWeekday } from "@/features/training-blocks/services/blockSchedulingService";
import { getSessionKindLabel, getSessionStatusLabel } from "@/features/training-blocks/services/sessionPresentation";
import { appTheme } from "@/theme/appTheme";

const WorkoutDetailScreen = () => {
  const router = useRouter();
  const params = useLocalSearchParams<{ sessionId?: string }>();
  const sessionId = typeof params.sessionId === "string" ? params.sessionId : null;
  const workoutReviewQuery = useCompletedWorkoutDetailQuery(sessionId);
  const quickCompleteSessionMutation = useQuickCompleteSessionMutation(sessionId);
  const saveAdjustedSessionResultsMutation = useSaveAdjustedSessionResultsMutation(sessionId);
  const [isAdjustedEntryVisible, setIsAdjustedEntryVisible] = useState(false);
  const [completionStatus, setCompletionStatus] = useState<"completed" | "partial" | "missed">(
    "completed",
  );
  const [adjustedValues, setAdjustedValues] = useState<Record<string, { reps: string; load: string }>>(
    {},
  );

  if (workoutReviewQuery.isLoading) {
    return (
      <ScreenContainer
        eyebrow="Workout Detail"
        title="Workout detail"
        description="Review the planned session and any logged results for the selected workout."
      >
        <Card>
          <LoadingState
            title="Loading session"
            description="Fetching the planned exercises, logged set results, and block context from local data."
          />
        </Card>
      </ScreenContainer>
    );
  }

  if (sessionId === null || workoutReviewQuery.data === null || workoutReviewQuery.data === undefined) {
    return (
      <ScreenContainer
        eyebrow="Workout Detail"
        title="Workout detail"
        description="Review the planned session and any logged results for the selected workout."
      >
        <Card>
          <EmptyState
            title="Session not found"
            description="This workout session could not be loaded from local plan data."
            action={
              <Button
                label="Back to Today"
                onPress={() => {
                  router.push("/(tabs)/today");
                }}
                variant="secondary"
              />
            }
          />
        </Card>
      </ScreenContainer>
    );
  }

  const workoutReview = workoutReviewQuery.data;
  const plannedSession = workoutReview.session;
  const workoutResult = workoutReview.workoutResult;
  const isCompleted = plannedSession.status === "completed";
  const isBenchmarkSession = plannedSession.sessionType === "benchmark";
  const isFinalTestSession = plannedSession.sessionType === "final-test";
  const isEvaluationSession = isBenchmarkSession || isFinalTestSession;
  const scheduledWeekdayLabel = formatTrainingWeekday(plannedSession.scheduledWeekday);
  const loggedSetResultByPlannedSetId = new Map(
    workoutReview.loggedSetResults
      .filter((loggedSetResult) => loggedSetResult.plannedSetId !== null)
      .map((loggedSetResult) => [loggedSetResult.plannedSetId as string, loggedSetResult] as const),
  );

  const updateAdjustedValue = (
    plannedSetId: string,
    field: "reps" | "load",
    value: string,
  ) => {
    setAdjustedValues((current) => ({
      ...current,
      [plannedSetId]: {
        reps: current[plannedSetId]?.reps ?? "",
        load: current[plannedSetId]?.load ?? "",
        [field]: value,
      },
    }));
  };

  const handleSaveAdjustedResults = async () => {
    if (sessionId === null) {
      return;
    }

    await saveAdjustedSessionResultsMutation.mutateAsync({
      sessionId,
      completionStatus,
      setResults: plannedSession.plannedExercises.flatMap((exercise) =>
        exercise.plannedSets.map((plannedSet) => {
          const adjustedValue = adjustedValues[plannedSet.id];
          const parsedReps =
            adjustedValue?.reps.trim() === undefined || adjustedValue?.reps.trim() === ""
              ? plannedSet.targetReps
              : Number(adjustedValue.reps);
          const parsedLoad =
            adjustedValue?.load.trim() === undefined || adjustedValue?.load.trim() === ""
              ? plannedSet.targetLoad
              : Number(adjustedValue.load);

          return {
            plannedSetId: plannedSet.id,
            setIndex: plannedSet.setIndex,
            actualReps: Number.isFinite(parsedReps) ? parsedReps : plannedSet.targetReps,
            actualLoad: Number.isFinite(parsedLoad) ? parsedLoad : plannedSet.targetLoad,
            actualRpe: plannedSet.targetRpe,
            isCompleted: completionStatus !== "missed",
          };
        }),
      ),
    });

    setIsAdjustedEntryVisible(false);
  };

  return (
    <ScreenContainer
      eyebrow={isEvaluationSession ? "Evaluation Session" : "Workout Detail"}
      title={plannedSession.title}
      description={
        isEvaluationSession
          ? "Benchmark and final-test sessions keep setup benchmarks, scheduled testing work, and recorded outcomes clearly separated."
          : "Review the planned session details and any recorded results for this workout."
      }
    >
      <Card>
        <View style={styles.header}>
          <Text style={styles.headerEyebrow}>
            {isBenchmarkSession
              ? isCompleted
                ? "Completed benchmark session"
                : "Benchmark test session"
              : isFinalTestSession
                ? isCompleted
                  ? "Completed final test session"
                  : "Final test session"
              : isCompleted
                ? "Completed session"
                : "Planned session"}
          </Text>
          <Text style={styles.headerDescription}>
            Session #{plannedSession.sessionIndex} for week {plannedSession.weekIndex}, scheduled on{" "}
            {plannedSession.scheduledDate}
            {scheduledWeekdayLabel === null ? "." : ` (${scheduledWeekdayLabel}).`}
          </Text>
        </View>
        <View style={styles.badgeRow}>
          <View style={styles.badge}>
            <Text style={styles.badgeLabel}>Kind</Text>
            <Text style={styles.badgeValue}>{getSessionKindLabel(plannedSession)}</Text>
          </View>
          <View style={styles.badge}>
            <Text style={styles.badgeLabel}>Status</Text>
            <Text style={styles.badgeValue}>{getSessionStatusLabel(plannedSession)}</Text>
          </View>
          <View style={styles.badge}>
            <Text style={styles.badgeLabel}>Exercises</Text>
            <Text style={styles.badgeValue}>{plannedSession.plannedExercises.length}</Text>
          </View>
          {scheduledWeekdayLabel !== null ? (
            <View style={styles.badge}>
              <Text style={styles.badgeLabel}>Weekday</Text>
              <Text style={styles.badgeValue}>{scheduledWeekdayLabel}</Text>
            </View>
          ) : null}
        </View>
      </Card>

      <Card>
        <Text style={styles.testSessionTitle}>Block context</Text>
        <Text style={styles.testSessionDescription}>
          {workoutReview.block.name}
          {workoutReview.block.status === "archived"
            ? " is archived after a later regeneration."
            : " is the current active block."}
        </Text>
        {workoutResult !== null ? (
          <>
            <Text style={styles.testSessionTitle}>
              {isEvaluationSession ? "Recorded evaluation outcome" : "Recorded workout outcome"}
            </Text>
            <Text style={styles.testSessionDescription}>
              {workoutResult.completionStatus} on {workoutResult.completedAt.slice(0, 10)}.
              {isBenchmarkSession
                ? " This is the recorded benchmark result for the scheduled benchmark session."
                : isFinalTestSession
                  ? " This is the recorded final-test result for the scheduled final-test session."
                  : " This is the recorded result for the scheduled workout session."}
            </Text>
          </>
        ) : (
          <Text style={styles.testSessionDescription}>
            No recorded result has been saved yet for this session.
          </Text>
        )}
      </Card>

      {isEvaluationSession ? (
        <Card>
          <Text style={styles.testSessionTitle}>
            {isBenchmarkSession ? "Benchmark capture flow" : "Final test capture flow"}
          </Text>
          <Text style={styles.testSessionDescription}>
            Saved benchmark inputs are the setup values used to generate the plan. This scheduled
            session is the separate testing workout where the recorded benchmark outcome is logged.
          </Text>
        </Card>
      ) : null}

      {plannedSession.plannedExercises.map((exercise) => (
        <Card key={exercise.id}>
          <View style={styles.exerciseHeader}>
            <Text style={styles.exerciseName}>{exercise.exerciseName}</Text>
            <Text style={styles.exerciseMeta}>{exercise.prescriptionKind}</Text>
          </View>
          {exercise.plannedSets.map((plannedSet) => (
            <View key={plannedSet.id} style={styles.setReviewBlock}>
              <ListRow
                title={`Set ${plannedSet.setIndex}`}
                description={`Planned: ${plannedSet.targetReps} reps at ${plannedSet.targetLoad} kg`}
                trailing={
                  plannedSet.targetRpe === null
                    ? `${plannedSet.restSeconds ?? 0}s rest`
                    : `RPE ${plannedSet.targetRpe}`
                }
              />
              {loggedSetResultByPlannedSetId.has(plannedSet.id) ? (
                <Text style={styles.loggedResultText}>
                  Recorded: {loggedSetResultByPlannedSetId.get(plannedSet.id)?.actualReps ?? "-"} reps
                  at {loggedSetResultByPlannedSetId.get(plannedSet.id)?.actualLoad ?? "-"} kg
                </Text>
              ) : null}
            </View>
          ))}
        </Card>
      ))}

      <Card>
        {quickCompleteSessionMutation.isError ? (
          <Text style={styles.errorText}>
            {quickCompleteSessionMutation.error instanceof Error
              ? quickCompleteSessionMutation.error.message
              : "Quick completion failed. Try again from this session screen."}
          </Text>
        ) : null}
        {saveAdjustedSessionResultsMutation.isError ? (
          <Text style={styles.errorText}>
            {saveAdjustedSessionResultsMutation.error instanceof Error
              ? saveAdjustedSessionResultsMutation.error.message
              : "Adjusted result saving failed. Review the entered values and try again."}
          </Text>
        ) : null}
        <Button
          disabled={isCompleted}
          label={
            isCompleted
              ? "Session already completed"
              : quickCompleteSessionMutation.isPending
                ? isBenchmarkSession
                  ? "Saving benchmark result..."
                  : isFinalTestSession
                    ? "Saving final test result..."
                  : "Saving completion..."
                : isBenchmarkSession
                  ? "Save benchmark as completed"
                  : isFinalTestSession
                    ? "Save final test as completed"
                  : "Quick complete session"
          }
          onPress={() => {
            if (isCompleted) {
              return;
            }

            void quickCompleteSessionMutation.mutateAsync();
          }}
          variant={isCompleted ? "secondary" : "primary"}
        />
        <Button
          disabled={isCompleted}
          label={
            isAdjustedEntryVisible
              ? isBenchmarkSession
                ? "Hide benchmark result entry"
                : isFinalTestSession
                  ? "Hide final test result entry"
                : "Hide adjusted result entry"
              : isBenchmarkSession
                ? "Record benchmark result"
                : isFinalTestSession
                  ? "Record final test result"
                : "Enter adjusted results"
          }
          onPress={() => {
            if (isCompleted) {
              return;
            }

            setIsAdjustedEntryVisible((current) => !current);
          }}
          variant="secondary"
        />
      </Card>

      {isAdjustedEntryVisible ? (
        <Card>
          <View style={styles.adjustedHeader}>
            <Text style={styles.adjustedTitle}>
              {isBenchmarkSession
                ? "Benchmark result entry"
                : isFinalTestSession
                  ? "Final test result entry"
                  : "Adjusted result entry"}
            </Text>
            <Text style={styles.adjustedDescription}>
              {isEvaluationSession
                ? "Record the actual testing output so it can be reviewed separately from the saved benchmark setup values."
                : "Save actual reps and load for sets that were modified, partially completed, or missed."}
            </Text>
          </View>
          <View style={styles.statusRow}>
            {(["completed", "partial", "missed"] as const).map((statusOption) => (
              <Button
                key={statusOption}
                label={statusOption}
                onPress={() => {
                  setCompletionStatus(statusOption);
                }}
                variant={completionStatus === statusOption ? "primary" : "secondary"}
              />
            ))}
          </View>
          {plannedSession.plannedExercises.map((exercise) => (
            <Card key={`${exercise.id}-adjusted`}>
              <Text style={styles.exerciseName}>{exercise.exerciseName}</Text>
              {exercise.plannedSets.map((plannedSet) => (
                <View key={`${plannedSet.id}-fields`} style={styles.adjustedSetBlock}>
                  <Text style={styles.adjustedSetTitle}>Set {plannedSet.setIndex}</Text>
                  <NumberField
                    helperText={
                      isBenchmarkSession || isFinalTestSession
                        ? `Planned test reps: ${plannedSet.targetReps}`
                        : `Default planned reps: ${plannedSet.targetReps}`
                    }
                    label={isEvaluationSession ? "Recorded reps" : "Actual reps"}
                    onChangeText={(value) => {
                      updateAdjustedValue(plannedSet.id, "reps", value);
                    }}
                    value={adjustedValues[plannedSet.id]?.reps ?? ""}
                  />
                  <NumberField
                    helperText={
                      isBenchmarkSession || isFinalTestSession
                        ? `Planned test load: ${plannedSet.targetLoad} kg`
                        : `Default planned load: ${plannedSet.targetLoad} kg`
                    }
                    label={isEvaluationSession ? "Recorded load" : "Actual load"}
                    onChangeText={(value) => {
                      updateAdjustedValue(plannedSet.id, "load", value);
                    }}
                    value={adjustedValues[plannedSet.id]?.load ?? ""}
                  />
                </View>
              ))}
            </Card>
          ))}
          <Button
            label={
              saveAdjustedSessionResultsMutation.isPending
                ? isBenchmarkSession
                  ? "Saving benchmark result..."
                  : isFinalTestSession
                    ? "Saving final test result..."
                  : "Saving adjusted results..."
                : isBenchmarkSession
                  ? "Save benchmark result"
                  : isFinalTestSession
                    ? "Save final test result"
                  : "Save adjusted results"
            }
            onPress={() => {
              void handleSaveAdjustedResults();
            }}
          />
        </Card>
      ) : null}
      <Card>
        <Button
          label={workoutReview.block.status === "archived" ? "Back to History" : "Back to Today"}
          onPress={() => {
            router.push(
              workoutReview.block.status === "archived" ? "/(tabs)/history" : "/(tabs)/today",
            );
          }}
          variant="secondary"
        />
        <Button
          label="Back to full plan"
          onPress={() => {
            router.push("/plan");
          }}
          variant="secondary"
        />
      </Card>
    </ScreenContainer>
  );
};

export default WorkoutDetailScreen;

const styles = StyleSheet.create({
  header: {
    gap: appTheme.spacing.xs,
  },
  headerEyebrow: {
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 1.2,
    textTransform: "uppercase",
    color: appTheme.colors.accent,
  },
  headerDescription: {
    fontSize: 15,
    lineHeight: 22,
    color: appTheme.colors.textSecondary,
  },
  badgeRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: appTheme.spacing.sm,
  },
  badge: {
    minWidth: 96,
    gap: 4,
    borderRadius: appTheme.radius.md,
    paddingHorizontal: appTheme.spacing.md,
    paddingVertical: appTheme.spacing.sm,
    backgroundColor: appTheme.colors.surfaceMuted,
  },
  badgeLabel: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1,
    textTransform: "uppercase",
    color: appTheme.colors.textMuted,
  },
  badgeValue: {
    fontSize: 14,
    fontWeight: "700",
    color: appTheme.colors.textPrimary,
  },
  exerciseHeader: {
    gap: 4,
  },
  exerciseName: {
    fontSize: 18,
    fontWeight: "800",
    color: appTheme.colors.textPrimary,
  },
  exerciseMeta: {
    fontSize: 13,
    color: appTheme.colors.textSecondary,
    textTransform: "capitalize",
  },
  setReviewBlock: {
    gap: 6,
  },
  loggedResultText: {
    fontSize: 13,
    lineHeight: 20,
    color: appTheme.colors.textSecondary,
  },
  errorText: {
    fontSize: 13,
    lineHeight: 20,
    color: appTheme.colors.danger,
  },
  adjustedHeader: {
    gap: appTheme.spacing.xs,
  },
  adjustedTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: appTheme.colors.textPrimary,
  },
  adjustedDescription: {
    fontSize: 14,
    lineHeight: 20,
    color: appTheme.colors.textSecondary,
  },
  statusRow: {
    gap: appTheme.spacing.sm,
  },
  adjustedSetBlock: {
    gap: appTheme.spacing.sm,
  },
  adjustedSetTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: appTheme.colors.textPrimary,
  },
  testSessionTitle: {
    fontSize: 17,
    fontWeight: "800",
    color: appTheme.colors.textPrimary,
  },
  testSessionDescription: {
    fontSize: 14,
    lineHeight: 21,
    color: appTheme.colors.textSecondary,
  },
});
