/**
 * Shared metrics collection logic
 * Can be called from cron jobs or triggered by trade events
 */

import { getAccountInformationAndPerformance } from "@/lib/trading/account-information-and-performance";
import { prisma } from "@/lib/prisma";
import { ModelType } from "@prisma/client";
import { InputJsonValue, JsonValue } from "@prisma/client/runtime/library";
import { isDryRunMode, dryRunWallet } from "@/lib/trading/dry-run-wallet";

// Maximum number of metrics to keep
const MAX_METRICS_COUNT = 100;

/**
 * Uniformly sample the array, keeping the first and last elements unchanged
 */
function uniformSampleWithBoundaries<T>(data: T[], maxSize: number): T[] {
  if (data.length <= maxSize) {
    return data;
  }

  const result: T[] = [];
  const step = (data.length - 1) / (maxSize - 1);

  for (let i = 0; i < maxSize; i++) {
    const index = Math.round(i * step);
    result.push(data[index]);
  }

  return result;
}

interface CollectMetricsOptions {
  initialCapital: number;
  model?: ModelType;
  reason?: "cron" | "trade" | "manual";
  tradeId?: string; // Optional reference to the trade that triggered this collection
}

/**
 * Collect and store a metrics snapshot
 *
 * @param options - Configuration for metrics collection
 * @returns The metrics count after collection
 */
export async function collectMetrics(options: CollectMetricsOptions): Promise<{
  success: boolean;
  metricsCount: number;
  reason: string;
}> {
  const {
    initialCapital,
    model = ModelType.Deepseek,
    reason = "manual",
    tradeId,
  } = options;

  // CRITICAL FIX: Ensure wallet is restored before collecting metrics
  // This prevents the $10,000 balance spike on server restart
  if (isDryRunMode()) {
    const startMoney = Number(process.env.START_MONEY) || 10000;
    const currentBalance = dryRunWallet.getBalance();
    const currentPnL = dryRunWallet.getTotalPnL();
    const positions = dryRunWallet.getPositions();

    // Check if wallet appears uninitialized (same logic as /api/positions)
    const walletAppearsUninitialized =
      currentBalance === startMoney &&
      currentPnL === 0 &&
      positions.length === 0;

    if (walletAppearsUninitialized) {
      console.log("[METRICS-COLLECT] Wallet uninitialized, restoring from database...");
      const { restoreDryRunWallet } = await import("@/lib/trading/restore-dry-run-wallet");
      await restoreDryRunWallet();
      console.log("[METRICS-COLLECT] Wallet restoration complete");
    }
  }

  const accountInformationAndPerformance =
    await getAccountInformationAndPerformance(initialCapital);

  let existMetrics = await prisma.metrics.findFirst({
    where: { model },
  });

  if (!existMetrics) {
    existMetrics = await prisma.metrics.create({
      data: {
        name: "metrics",
        metrics: [],
        model,
      },
    });
  }

  // Add new metrics with metadata
  const newMetric = {
    accountInformationAndPerformance,
    createdAt: new Date().toISOString(),
    reason, // Track why this metric was collected
    tradeId, // Link to trade if applicable
  };

  const newMetrics = [
    ...((existMetrics?.metrics || []) as JsonValue[]),
    newMetric,
  ] as JsonValue[];

  // If the metrics count exceeds the maximum limit, uniformly sample the metrics
  let finalMetrics = newMetrics;
  if (newMetrics.length > MAX_METRICS_COUNT) {
    finalMetrics = uniformSampleWithBoundaries(newMetrics, MAX_METRICS_COUNT);
  }

  await prisma.metrics.update({
    where: { id: existMetrics?.id },
    data: {
      metrics: finalMetrics as InputJsonValue[],
    },
  });

  const logPrefix = `[METRICS-COLLECT]`;
  const reasonStr = tradeId ? `${reason} (trade: ${tradeId.slice(0, 8)})` : reason;
  console.log(`${logPrefix} Collected metrics (reason: ${reasonStr}), count: ${finalMetrics.length}`);

  return {
    success: true,
    metricsCount: finalMetrics.length,
    reason: reasonStr,
  };
}
