import { useRouter } from "expo-router";
import { Alert, StyleSheet, Text, View } from "react-native";

import { Button, Card, ListRow } from "@/components/ui";
import { useActiveTrainingBlockQuery } from "@/features/training-blocks/queries/useActiveTrainingBlockQuery";
import { useBenchmarksQuery } from "@/features/training-blocks/queries/useBenchmarksQuery";
import { useBlockConfigurationQuery } from "@/features/training-blocks/queries/useBlockConfigurationQuery";
import { useCreateActiveTrainingBlockMutation } from "@/features/training-blocks/queries/useCreateActiveTrainingBlockMutation";
import {
  getReadinessWarnings,
  summarizeGenerationReview,
  summarizeLiftPools,
  summarizeSavedBenchmarks,
} from "@/features/training-blocks/services/blockGenerationReadinessService";
import {
  doesConfigurationRequireRegeneration,
  regenerationRules,
  summarizeConfigurationChanges,
} from "@/features/training-blocks/services/blockRegenerationService";
import { summarizeBlockConfiguration } from "@/features/training-blocks/services/blockConfigurationService";
import { appTheme } from "@/theme/appTheme";

export const BlockGenerationCard = () => {
  const router = useRouter();
  const benchmarksQuery = useBenchmarksQuery();
  const blockConfigurationQuery = useBlockConfigurationQuery();
  const activeTrainingBlockQuery = useActiveTrainingBlockQuery();
  const createActiveTrainingBlockMutation = useCreateActiveTrainingBlockMutation();

  const savedBlockConfiguration = blockConfigurationQuery.data;
  const hasSavedBlockConfiguration =
    savedBlockConfiguration !== null && savedBlockConfiguration !== undefined;
  const requiredBenchmarkCount = savedBlockConfiguration?.benchmarkLiftSlugs.length ?? 0;
  const savedBenchmarkCount = savedBlockConfiguration?.benchmarkLiftSlugs.filter((liftSlug) =>
    (benchmarksQuery.data ?? []).some((benchmark) => benchmark.liftSlug === liftSlug),
  ).length ?? 0;
  const hasRequiredBenchmarks = requiredBenchmarkCount > 0 && savedBenchmarkCount === requiredBenchmarkCount;
  const generationReady = hasRequiredBenchmarks && hasSavedBlockConfiguration;
  const activePlan = activeTrainingBlockQuery.data;
  const nextSession = activePlan?.sessions[0];
  const readinessWarnings = getReadinessWarnings(benchmarksQuery.data, savedBlockConfiguration);
  const savedBenchmarkSummaries = summarizeSavedBenchmarks(
    benchmarksQuery.data,
    savedBlockConfiguration?.benchmarkLiftSlugs,
  );
  const generationReview = hasSavedBlockConfiguration
    ? summarizeGenerationReview(savedBlockConfiguration)
    : [];
  const liftPoolReview = hasSavedBlockConfiguration
    ? summarizeLiftPools(savedBlockConfiguration)
    : [];
  const requiresRegeneration = doesConfigurationRequireRegeneration(
    activePlan?.block.blockConfiguration ?? null,
    savedBlockConfiguration ?? null,
  );
  const configurationChangeSummary = summarizeConfigurationChanges(
    activePlan?.block.blockConfiguration ?? null,
    savedBlockConfiguration ?? null,
  );

  const executeGeneration = async () => {
    if (!generationReady) {
      return;
    }

    try {
      await createActiveTrainingBlockMutation.mutateAsync();
      router.push("/(tabs)/today");
    } catch {
      // The mutation state below renders the failure message.
    }
  };

  const handleGenerate = async () => {
    if (requiresRegeneration) {
      const confirmationSummary =
        configurationChangeSummary.length === 0
          ? "The saved setup no longer matches the active block."
          : configurationChangeSummary.map((change) => `- ${change}`).join("\n");

      Alert.alert(
        "Replace current active block?",
        `${regenerationRules.summary}\n\n${confirmationSummary}\n\n${regenerationRules.activeBlockReplacement}`,
        [
          {
            style: "cancel",
            text: "Cancel",
          },
          {
            style: "destructive",
            text: "Regenerate block",
            onPress: () => {
              void executeGeneration();
            },
          },
        ],
      );
      return;
    }

    await executeGeneration();
  };

  return (
    <Card>
      <View style={styles.header}>
        <Text style={styles.title}>Generate active block</Text>
        <Text style={styles.description}>
          Create one saved local training block from the setup and benchmark inputs above, then send
          it straight into Today.
        </Text>
      </View>
      <Text style={styles.status}>
        {generationReady
          ? `${savedBenchmarkCount} saved benchmarks are ready for generation.`
          : !hasRequiredBenchmarks
            ? requiredBenchmarkCount === 0
              ? "Select benchmark lifts in Block setup before generating a block."
              : `Save all ${requiredBenchmarkCount} selected benchmarks before generating a block.`
            : "Save a valid block configuration before generating a block."}
      </Text>
      <View style={styles.summaryBlock}>
        <Text style={styles.summaryLabel}>Saved benchmark inputs</Text>
        {savedBenchmarkSummaries.map((summary) => (
          <Text key={summary} style={styles.summaryCopy}>
            {summary}
          </Text>
        ))}
      </View>
      {hasSavedBlockConfiguration ? (
        <>
          <Text style={styles.status}>{summarizeBlockConfiguration(savedBlockConfiguration)}</Text>
          <View style={styles.summaryBlock}>
            <Text style={styles.summaryLabel}>Generation review</Text>
            {generationReview.map((summary) => (
              <Text key={summary} style={styles.summaryCopy}>
                {summary}
              </Text>
            ))}
            {liftPoolReview.map((summary) => (
              <Text key={summary} style={styles.summaryCopy}>
                {summary}
              </Text>
            ))}
          </View>
        </>
      ) : null}
      {readinessWarnings.length > 0 ? (
        <View style={styles.summaryBlock}>
          <Text style={styles.summaryLabel}>Readiness checks</Text>
          {readinessWarnings.map((warning) => (
            <Text key={warning} style={[styles.summaryCopy, styles.warningText]}>
              {warning}
            </Text>
          ))}
        </View>
      ) : (
        <View style={styles.summaryBlock}>
          <Text style={styles.summaryLabel}>Readiness checks</Text>
          <Text style={styles.summaryCopy}>
            Saved benchmark inputs and block setup are ready for generation.
          </Text>
        </View>
      )}
      {activePlan !== null && activePlan !== undefined ? (
        <View style={styles.activePlanSummary}>
          <Text style={styles.activePlanLabel}>Current active block</Text>
          <Text style={styles.activePlanValue}>{activePlan.block.name}</Text>
          <Text style={styles.activePlanMeta}>
            Next session: {nextSession?.title ?? "No planned sessions yet"}
          </Text>
          <ListRow
            title="Saved benchmark inputs vs. benchmark sessions"
            description="Saved benchmark inputs seed generation. Benchmark and final-test sessions are separate scheduled workouts and later logged outcomes."
          />
          {requiresRegeneration ? (
            <>
              <Text style={[styles.activePlanMeta, styles.warningText]}>
                Saved setup changes require confirmation before the active block is replaced.
              </Text>
              {configurationChangeSummary.map((summary) => (
                <Text key={summary} style={styles.activePlanMeta}>
                  {summary}
                </Text>
              ))}
            </>
          ) : null}
        </View>
      ) : null}
      {createActiveTrainingBlockMutation.isError ? (
        <Text style={[styles.status, styles.error]}>
          {createActiveTrainingBlockMutation.error instanceof Error
            ? createActiveTrainingBlockMutation.error.message
            : "Block generation failed. Check your saved benchmarks and try again."}
        </Text>
      ) : null}
      <Button
        disabled={!generationReady || createActiveTrainingBlockMutation.isPending}
        label={
          createActiveTrainingBlockMutation.isPending
            ? requiresRegeneration
              ? "Regenerating active block..."
              : "Generating active block..."
            : requiresRegeneration
              ? "Regenerate active block"
              : "Generate active block"
        }
        onPress={() => {
          void handleGenerate();
        }}
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
  status: {
    fontSize: 13,
    color: appTheme.colors.textSecondary,
  },
  summaryBlock: {
    gap: appTheme.spacing.xs,
    borderRadius: appTheme.radius.md,
    padding: appTheme.spacing.md,
    backgroundColor: appTheme.colors.surfaceMuted,
  },
  summaryLabel: {
    fontSize: 12,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 1,
    color: appTheme.colors.textMuted,
  },
  summaryCopy: {
    fontSize: 14,
    lineHeight: 21,
    color: appTheme.colors.textSecondary,
  },
  error: {
    color: appTheme.colors.danger,
  },
  warningText: {
    color: appTheme.colors.accent,
  },
  activePlanSummary: {
    gap: appTheme.spacing.xs,
    borderRadius: appTheme.radius.md,
    padding: appTheme.spacing.md,
    backgroundColor: appTheme.colors.surfaceMuted,
  },
  activePlanLabel: {
    fontSize: 12,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 1,
    color: appTheme.colors.textMuted,
  },
  activePlanValue: {
    fontSize: 17,
    fontWeight: "800",
    color: appTheme.colors.textPrimary,
  },
  activePlanMeta: {
    fontSize: 14,
    color: appTheme.colors.textSecondary,
  },
});
