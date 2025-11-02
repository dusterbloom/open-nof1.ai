import { prisma } from "@/lib/prisma";
import { ModelType } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { MetricData } from "@/lib/types/metrics";

/**
 * Intelligent downsampling based on time range
 * - ALL: 50 points (wide view)
 * - 72H: 100 points (3 days detail)
 * - 24H: 200 points (1 day high detail)
 * - 1H: No downsampling (maximum detail)
 */
const SAMPLE_SIZE_BY_RANGE: Record<string, number> = {
  ALL: 50,
  "72H": 100,
  "24H": 200,
  "1H": 1000, // Effectively no downsampling for 1 hour
};

/**
 * Uniformly sample array, keeping first and last elements
 */
function uniformSample<T>(data: T[], sampleSize: number): T[] {
  if (data.length <= sampleSize) {
    return data;
  }

  const result: T[] = [];
  const step = (data.length - 1) / (sampleSize - 1);

  for (let i = 0; i < sampleSize; i++) {
    const index = Math.round(i * step);
    result.push(data[index]);
  }

  return result;
}

/**
 * Calculate time cutoff for filtering metrics
 */
function getTimeCutoff(range: string): Date | null {
  const now = new Date();
  switch (range) {
    case "1H":
      return new Date(now.getTime() - 60 * 60 * 1000);
    case "24H":
      return new Date(now.getTime() - 24 * 60 * 60 * 1000);
    case "72H":
      return new Date(now.getTime() - 72 * 60 * 60 * 1000);
    case "ALL":
    default:
      return null; // No time filtering
  }
}

export const GET = async (request: NextRequest) => {
  try {
    // Get time range from query parameter (default: ALL)
    const { searchParams } = new URL(request.url);
    const range = searchParams.get("range") || "ALL";

    const metrics = await prisma.metrics.findFirst({
      where: {
        model: ModelType.Deepseek,
      },
      orderBy: { createdAt: "asc" }, // Always use the oldest (primary) record
    });

    if (!metrics) {
      return NextResponse.json({
        data: {
          metrics: [],
          totalCount: 0,
          filteredCount: 0,
          range,
        },
        success: true,
      });
    }

    const databaseMetrics = metrics.metrics as unknown as {
      createdAt: string;
      accountInformationAndPerformance: MetricData[];
      reason?: string;
      tradeId?: string;
    }[];

    // Transform metrics data
    let metricsData = databaseMetrics
      .map((item) => {
        return {
          ...item.accountInformationAndPerformance,
          createdAt: item?.createdAt || new Date().toISOString(),
          reason: item?.reason,
          tradeId: item?.tradeId,
        };
      })
      .filter((item) => (item as unknown as MetricData).availableCash > 0);

    const totalCount = metricsData.length;

    // STEP 1: Filter by time range FIRST (before downsampling)
    const timeCutoff = getTimeCutoff(range);
    if (timeCutoff) {
      metricsData = metricsData.filter((item) => {
        const itemDate = new Date(item.createdAt);
        return itemDate >= timeCutoff;
      });
    }

    const filteredCount = metricsData.length;

    // STEP 2: Apply intelligent downsampling based on selected range
    const sampleSize = SAMPLE_SIZE_BY_RANGE[range] || SAMPLE_SIZE_BY_RANGE.ALL;
    const sampledMetrics = uniformSample(metricsData, sampleSize);

    console.log(
      `📊 [METRICS API] Range: ${range}, Total: ${totalCount}, Filtered: ${filteredCount}, Sampled: ${sampledMetrics.length}`
    );

    return NextResponse.json({
      data: {
        metrics: sampledMetrics,
        totalCount,
        filteredCount,
        sampledCount: sampledMetrics.length,
        range,
        model: metrics?.model || ModelType.Deepseek,
        name: metrics?.name || "Deepseek Trading Bot",
        createdAt: metrics?.createdAt || new Date().toISOString(),
        updatedAt: metrics?.updatedAt || new Date().toISOString(),
      },
      success: true,
    });
  } catch (error) {
    console.error("Error fetching metrics:", error);
    return NextResponse.json({
      data: {
        metrics: [],
        totalCount: 0,
        filteredCount: 0,
        sampledCount: 0,
        range: "ALL",
        model: ModelType.Deepseek,
        name: "Deepseek Trading Bot",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      success: true,
    });
  }
};
