import { NextRequest } from "next/server";
import jwt from "jsonwebtoken";
import { collectMetrics } from "@/lib/metrics/collect-metrics";

export const GET = async (request: NextRequest) => {
  const url = new URL(request.url);
  const token = url.searchParams.get("token");

  if (!token) {
    return new Response("Token is required", { status: 400 });
  }

  try {
    jwt.verify(token, process.env.CRON_SECRET_KEY || "");
  } catch {
    return new Response("Invalid token", { status: 401 });
  }

  const result = await collectMetrics({
    initialCapital: Number(process.env.START_MONEY) || 10000,
    reason: "cron",
  });

  return new Response(
    `Process executed successfully. Metrics count: ${result.metricsCount} (${result.reason})`
  );
};
