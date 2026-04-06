import { useLocalSearchParams, useRouter } from "expo-router";
import { StyleSheet, Text, View } from "react-native";

import { Button, Card, EmptyState, ListRow, LoadingState, ScreenContainer } from "@/components/ui";
import { usePlannedSessionDetailQuery } from "@/features/training-blocks/queries/usePlannedSessionDetailQuery";
import { useQuickCompleteSessionMutation } from "@/features/training-blocks/queries/useQuickCompleteSessionMutation";
import { appTheme } from "@/theme/appTheme";

const WorkoutDetailScreen = () => {
  const router = useRouter();
  const params = useLocalSearchParams<{ sessionId?: string }>();
  const sessionId = typeof params.sessionId === "string" ? params.sessionId : null;
  const plannedSessionQuery = usePlannedSessionDetailQuery(sessionId);
  const quickCompleteSessionMutation = useQuickCompleteSessionMutation(sessionId);

  if (plannedSessionQuery.isLoading) {
    return (
      <ScreenContainer
        eyebrow="Workout Detail"
        title="Workout detail"
        description="Review the planned exercises and set targets for the selected session."
      >
        <Card>
          <LoadingState
            title="Loading session"
            description="Fetching the planned exercises, sets, and session structure from local data."
          />
        </Card>
      </ScreenContainer>
    );
  }

  if (sessionId === null || plannedSessionQuery.data === null || plannedSessionQuery.data === undefined) {
    return (
      <ScreenContainer
        eyebrow="Workout Detail"
        title="Workout detail"
        description="Review the planned exercises and set targets for the selected session."
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

  const plannedSession = plannedSessionQuery.data;
  const isCompleted = plannedSession.status === "completed";

  return (
    <ScreenContainer
      eyebrow="Workout Detail"
      title={plannedSession.title}
      description="This screen shows the planned execution details only. Logging flows will wire in next."
    >
      <Card>
        <View style={styles.header}>
          <Text style={styles.headerEyebrow}>
            {isCompleted ? "Completed session" : "Planned session"}
          </Text>
          <Text style={styles.headerDescription}>
            Session #{plannedSession.sessionIndex} for week {plannedSession.weekIndex}, scheduled on{" "}
            {plannedSession.scheduledDate}.
          </Text>
        </View>
        <View style={styles.badgeRow}>
          <View style={styles.badge}>
            <Text style={styles.badgeLabel}>Type</Text>
            <Text style={styles.badgeValue}>{plannedSession.sessionType}</Text>
          </View>
          <View style={styles.badge}>
            <Text style={styles.badgeLabel}>Status</Text>
            <Text style={styles.badgeValue}>{plannedSession.status}</Text>
          </View>
          <View style={styles.badge}>
            <Text style={styles.badgeLabel}>Exercises</Text>
            <Text style={styles.badgeValue}>{plannedSession.plannedExercises.length}</Text>
          </View>
        </View>
      </Card>

      {plannedSession.plannedExercises.map((exercise) => (
        <Card key={exercise.id}>
          <View style={styles.exerciseHeader}>
            <Text style={styles.exerciseName}>{exercise.exerciseName}</Text>
            <Text style={styles.exerciseMeta}>{exercise.prescriptionKind}</Text>
          </View>
          {exercise.plannedSets.map((plannedSet) => (
            <ListRow
              key={plannedSet.id}
              title={`Set ${plannedSet.setIndex}`}
              description={`${plannedSet.targetReps} reps at ${plannedSet.targetLoad}${exercise.liftSlug === "deadlift" ? " kg" : " kg"}`}
              trailing={
                plannedSet.targetRpe === null
                  ? `${plannedSet.restSeconds ?? 0}s rest`
                  : `RPE ${plannedSet.targetRpe}`
              }
            />
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
        <Button
          disabled={isCompleted}
          label={
            isCompleted
              ? "Session already completed"
              : quickCompleteSessionMutation.isPending
                ? "Saving completion..."
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
        <Button label="Enter adjusted results" variant="secondary" />
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
  errorText: {
    fontSize: 13,
    lineHeight: 20,
    color: appTheme.colors.danger,
  },
});
