import { useRouter } from "expo-router";
import { Alert, StyleSheet, Text, View } from "react-native";

import { Button, Card } from "@/components/ui";
import { useActiveTrainingBlockQuery } from "@/features/training-blocks/queries/useActiveTrainingBlockQuery";
import { useBenchmarksQuery } from "@/features/training-blocks/queries/useBenchmarksQuery";
import { useBlockConfigurationQuery } from "@/features/training-blocks/queries/useBlockConfigurationQuery";
import { useCreateActiveTrainingBlockMutation } from "@/features/training-blocks/queries/useCreateActiveTrainingBlockMutation";
import {
  doesConfigurationRequireRegeneration,
  regenerationRules,
} from "@/features/training-blocks/services/blockRegenerationService";
import { summarizeBlockConfiguration } from "@/features/training-blocks/services/blockConfigurationService";
import { appTheme } from "@/theme/appTheme";

const requiredBenchmarkCount = 4;

export const BlockGenerationCard = () => {
  const router = useRouter();
  const benchmarksQuery = useBenchmarksQuery();
  const blockConfigurationQuery = useBlockConfigurationQuery();
  const activeTrainingBlockQuery = useActiveTrainingBlockQuery();
  const createActiveTrainingBlockMutation = useCreateActiveTrainingBlockMutation();

  const benchmarkCount = benchmarksQuery.data?.length ?? 0;
  const hasRequiredBenchmarks = benchmarkCount >= requiredBenchmarkCount;
  const savedBlockConfiguration = blockConfigurationQuery.data;
  const hasSavedBlockConfiguration =
    savedBlockConfiguration !== null && savedBlockConfiguration !== undefined;
  const generationReady = hasRequiredBenchmarks && hasSavedBlockConfiguration;
  const activePlan = activeTrainingBlockQuery.data;
  const nextSession = activePlan?.sessions[0];
  const requiresRegeneration = doesConfigurationRequireRegeneration(
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
      Alert.alert(
        "Replace current active block?",
        `${regenerationRules.summary}\n\n${regenerationRules.activeBlockReplacement}`,
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
          Create one saved local training block from the benchmarks above and send it to the Today
          flow.
        </Text>
      </View>
      <Text style={styles.status}>
        {generationReady
          ? `${benchmarkCount} saved benchmarks are ready for generation.`
          : !hasRequiredBenchmarks
            ? `Save all ${requiredBenchmarkCount} benchmarks before generating a block.`
            : "Save a valid block configuration before generating a block."}
      </Text>
      {hasSavedBlockConfiguration ? (
        <Text style={styles.status}>{summarizeBlockConfiguration(savedBlockConfiguration)}</Text>
      ) : null}
      {activePlan !== null && activePlan !== undefined ? (
        <View style={styles.activePlanSummary}>
          <Text style={styles.activePlanLabel}>Current active block</Text>
          <Text style={styles.activePlanValue}>{activePlan.block.name}</Text>
          <Text style={styles.activePlanMeta}>
            Next session: {nextSession?.title ?? "No planned sessions yet"}
          </Text>
          {requiresRegeneration ? (
            <Text style={[styles.activePlanMeta, styles.warningText]}>
              Saved setup changes require confirmation before the active block is replaced.
            </Text>
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
