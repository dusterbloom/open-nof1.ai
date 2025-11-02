"use client";

import { useState, useMemo, useEffect, useRef } from "react";
import { CartesianGrid, Line, LineChart, XAxis, YAxis, ReferenceLine, ReferenceDot } from "recharts";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
} from "@/components/ui/chart";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { MetricData } from "@/lib/types/metrics";
import { ArcticonsDeepseek } from "@/lib/icons";

interface MetricsChartProps {
  metricsData: MetricData[];
  loading: boolean;
  lastUpdate: string;
  totalCount?: number;
}

type TimeRange = "ALL" | "72H" | "24H" | "1H";

// Trade types from Prisma schema
type TradeOperation = "Buy" | "Sell" | "Hold";
type TradeSymbol = "BTC" | "ETH" | "BNB" | "SOL" | "DOGE";

interface Trade {
  id: string;
  symbol: TradeSymbol;
  operation: TradeOperation;
  amount: number | null;
  pricing: number | null;
  leverage: number | null;
  stopLoss: number | null;
  takeProfit: number | null;
  positionId: string | null;
  success: boolean;
  errorMessage: string | null;
  createdAt: string;
  updatedAt: string;
  chat?: {
    reasoning: string;
    chat: string;
  };
}

const chartConfig = {
  totalCashValue: {
    label: "Cash Value",
    color: "#0066FF", // Deepseek 蓝色
  },
} satisfies ChartConfig;

// Deepseek 品牌色
const DEEPSEEK_BLUE = "#0066FF";

// 自定义最后一个点的渲染（带动画）
interface CustomDotProps {
  cx?: number;
  cy?: number;
  index?: number;
  payload?: MetricData;
  dataLength: number;
}

const CustomDot = (props: CustomDotProps) => {
  const { cx, cy, index, payload, dataLength } = props;

  // 只在最后一个点显示 logo 和价格
  if (!payload || !cx || !cy || index !== dataLength - 1) {
    return null;
  }

  const price = payload.totalCashValue;
  const priceText = `$${price?.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

  // CustomDot 必须返回 SVG 元素，因为它是在 recharts 的 SVG 上下文中渲染的
  // 可以使用 <g> 包裹多个 SVG 元素，或使用 <foreignObject> 嵌入 HTML
  return (
    <g>
      {/* 动画圆圈 - 纯 SVG */}
      <circle
        cx={cx}
        cy={cy}
        r={20}
        fill={DEEPSEEK_BLUE}
        opacity={0.2}
        className="animate-ping"
      />
      {/* 主圆点 - 纯 SVG */}
      <circle
        cx={cx}
        cy={cy}
        r={8}
        fill={DEEPSEEK_BLUE}
        stroke="#fff"
        strokeWidth={2}
      />

      {/* Logo 和价格容器 - 使用 foreignObject 嵌入 HTML/React 组件 */}
      <foreignObject x={cx + 15} y={cy - 30} width={180} height={60}>
        <div className="flex items-center gap-2 bg-background border border-border rounded-lg px-3 py-2 shadow-lg">
          {/* Deepseek Logo */}
          <div className="relative w-10 h-10 rounded-full bg-[#0066FF] flex items-center justify-center flex-shrink-0">
            <ArcticonsDeepseek className="w-6 h-6 text-black" />
          </div>
          {/* 价格 */}
          <div className="flex flex-col">
            <div className="text-[10px] text-muted-foreground font-medium">
              Deepseek
            </div>
            <div className="text-sm font-mono font-bold whitespace-nowrap">
              {priceText}
            </div>
          </div>
        </div>
      </foreignObject>
    </g>
  );
};

export function MetricsChart({
  metricsData: initialMetricsData,
  loading: initialLoading,
  totalCount: initialTotalCount,
}: MetricsChartProps) {
  const [timeRange, setTimeRange] = useState<TimeRange>("ALL");
  const [trades, setTrades] = useState<Trade[]>([]);

  // Local state for metrics (will be refetched when timeRange changes)
  const [metricsData, setMetricsData] = useState<MetricData[]>(initialMetricsData);
  const [loading, setLoading] = useState(initialLoading);
  const [totalCount, setTotalCount] = useState(initialTotalCount);

  // Zoom state
  const [yZoom, setYZoom] = useState(1);
  const [xZoom, setXZoom] = useState(1);
  const chartRef = useRef<HTMLDivElement>(null);

  // Filter state
  const [showPositions, setShowPositions] = useState(true);
  const [showTrades, setShowTrades] = useState(true);
  const [selectedSymbols, setSelectedSymbols] = useState<Set<TradeSymbol>>(new Set(["BTC", "ETH", "BNB", "SOL", "DOGE"]));
  const [profitabilityFilter, setProfitabilityFilter] = useState<"all" | "profitable" | "losing">("all");
  const [tradeTypeFilter, setTradeTypeFilter] = useState<Set<TradeOperation>>(new Set(["Buy", "Sell", "Hold"]));

  // Fetch metrics data with range parameter
  useEffect(() => {
    const fetchMetrics = async () => {
      try {
        setLoading(true);
        const response = await fetch(`/api/metrics?range=${timeRange}`);
        const result = await response.json();
        if (result.success && result.data) {
          setMetricsData(result.data.metrics || []);
          setTotalCount(result.data.filteredCount || 0);
          console.log(`[METRICS CHART] Fetched ${result.data.metrics.length} metrics for range: ${timeRange}`);
        }
      } catch (error) {
        console.error("Failed to fetch metrics:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchMetrics();
  }, [timeRange]);

  // Fetch trades data
  useEffect(() => {
    const fetchTrades = async () => {
      try {
        const response = await fetch("/api/trades");
        const result = await response.json();
        if (result.success) {
          setTrades(result.data);
        }
      } catch (error) {
        console.error("Failed to fetch trades:", error);
      }
    };
    fetchTrades();
  }, []);

  // No need for client-side time filtering anymore - handled by API
  const filteredData = metricsData;

  // Filter trades based on user filters
  const filteredTrades = useMemo(() => {
    return trades.filter(trade => {
      // Symbol filter
      if (!selectedSymbols.has(trade.symbol)) return false;

      // Trade type filter
      if (!tradeTypeFilter.has(trade.operation)) return false;

      // Profitability filter (requires position matching)
      if (profitabilityFilter !== "all" && trade.positionId) {
        const openTrade = trades.find(t => t.positionId === trade.positionId && t.operation === "Buy");
        const closeTrade = trades.find(t => t.positionId === trade.positionId && t.operation === "Sell");

        if (openTrade && closeTrade && openTrade.pricing && closeTrade.pricing) {
          const isProfitable = closeTrade.pricing > openTrade.pricing;
          if (profitabilityFilter === "profitable" && !isProfitable) return false;
          if (profitabilityFilter === "losing" && isProfitable) return false;
        }
      }

      return true;
    });
  }, [trades, selectedSymbols, profitabilityFilter, tradeTypeFilter]);

  // Calculate position lines (entry/exit pairs)
  const positionLines = useMemo(() => {
    if (!showPositions) return [];

    const lines: Array<{
      positionId: string;
      entry: Trade;
      exit: Trade | null;
    }> = [];

    const positionMap = new Map<string, { entry: Trade | null; exit: Trade | null }>();

    filteredTrades.forEach(trade => {
      if (!trade.positionId) return;

      if (!positionMap.has(trade.positionId)) {
        positionMap.set(trade.positionId, { entry: null, exit: null });
      }

      const position = positionMap.get(trade.positionId)!;

      if (trade.operation === "Buy") {
        position.entry = trade;
      } else if (trade.operation === "Sell") {
        position.exit = trade;
      }
    });

    positionMap.forEach((position, positionId) => {
      if (position.entry) {
        lines.push({
          positionId,
          entry: position.entry,
          exit: position.exit,
        });
      }
    });

    return lines;
  }, [filteredTrades, showPositions]);

  // Apply X-axis zoom by filtering data (Recharts doesn't support domain on categorical X-axis)
  const zoomFilteredData = useMemo(() => {
    if (xZoom === 1) return filteredData;

    const totalPoints = filteredData.length;
    const visiblePoints = Math.ceil(totalPoints / xZoom);
    const startIndex = Math.floor((totalPoints - visiblePoints) / 2);

    return filteredData.slice(startIndex, startIndex + visiblePoints);
  }, [filteredData, xZoom]);

  // Calculate trade dots (map to chart coordinates using zoomFilteredData)
  const tradeDots = useMemo(() => {
    if (!showTrades) return [];
    if (zoomFilteredData.length === 0) return [];

    return filteredTrades
      .map(trade => {
        // Find the closest metric data point in zoomFilteredData
        const tradeTime = new Date(trade.createdAt).getTime();
        let closestMetric = zoomFilteredData[0];
        let minDiff = Math.abs(new Date(zoomFilteredData[0]?.createdAt || 0).getTime() - tradeTime);

        zoomFilteredData.forEach(metric => {
          const diff = Math.abs(new Date(metric.createdAt).getTime() - tradeTime);
          if (diff < minDiff) {
            minDiff = diff;
            closestMetric = metric;
          }
        });

        return {
          createdAt: closestMetric.createdAt,  // Use metric timestamp for exact x-coordinate match
          totalCashValue: closestMetric?.totalCashValue || 0,
          operation: trade.operation,
          symbol: trade.symbol,
          leverage: trade.leverage,
          trade,
        };
      });
  }, [filteredTrades, zoomFilteredData, showTrades]);

  // Calculate dynamic Y-axis domain
  const yDomain = useMemo(() => {
    if (zoomFilteredData.length === 0) return [0, 50000];

    const values = zoomFilteredData.map(d => d.totalCashValue);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const padding = (max - min) * 0.1 / yZoom;

    return [
      Math.max(0, min - padding),
      max + padding
    ];
  }, [zoomFilteredData, yZoom]);

  // Handle mouse wheel zoom
  useEffect(() => {
    const handleWheel = (e: WheelEvent) => {
      if (!chartRef.current?.contains(e.target as Node)) {
        return;
      }

      e.preventDefault();
      // More aggressive zoom: 15% per scroll instead of 10%
      const delta = e.deltaY > 0 ? 0.85 : 1.15;

      if (e.shiftKey) {
        // X-axis zoom (wide range for both in and out)
        setXZoom(prev => Math.max(0.01, Math.min(20, prev * delta)));
      } else {
        // Y-axis zoom (extreme range: 0.01x - 500x for both micro and macro views)
        setYZoom(prev => Math.max(0.01, Math.min(500, prev * delta)));
      }
    };

    const chartElement = chartRef.current;

    // Only add listener if element exists
    if (!chartElement) {
      return;
    }

    chartElement.addEventListener("wheel", handleWheel, { passive: false });

    return () => {
      if (chartElement) {
        chartElement.removeEventListener("wheel", handleWheel);
      }
    };
  }, [filteredData.length]); // Re-run when data changes to ensure element exists

  // Reset zoom
  const resetZoom = () => {
    setYZoom(1);
    setXZoom(1);
  };

  // Toggle symbol
  const toggleSymbol = (symbol: TradeSymbol) => {
    setSelectedSymbols(prev => {
      const newSet = new Set(prev);
      if (newSet.has(symbol)) {
        newSet.delete(symbol);
      } else {
        newSet.add(symbol);
      }
      return newSet;
    });
  };

  // Toggle trade type
  const toggleTradeType = (type: TradeOperation) => {
    setTradeTypeFilter(prev => {
      const newSet = new Set(prev);
      if (newSet.has(type)) {
        newSet.delete(type);
      } else {
        newSet.add(type);
      }
      return newSet;
    });
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center h-[500px]">
          <div className="text-lg">Loading metrics...</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="h-full">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg">Total Account Value</CardTitle>
            <CardDescription className="text-xs">
              Real-time tracking • Updates every 10s
              {filteredData.length > 0 && totalCount && (
                <div className="mt-1">
                  {filteredData.length} of {totalCount.toLocaleString()} points
                </div>
              )}
            </CardDescription>
          </div>

          {/* Time Range Tabs */}
          <div className="flex gap-1 border rounded-lg p-1">
            {(["ALL", "72H", "24H", "1H"] as TimeRange[]).map((range) => (
              <button
                key={range}
                onClick={() => setTimeRange(range)}
                className={`px-3 py-1 text-xs font-medium rounded transition-colors ${
                  timeRange === range
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {range}
              </button>
            ))}
          </div>
        </div>
      </CardHeader>
      <CardContent className="px-2 sm:px-4 pb-4">
        {/* Filter Panel */}
        <div className="mb-4 p-4 border rounded-lg bg-muted/30">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* Toggles */}
            <div className="space-y-2">
              <Label className="text-xs font-semibold">Display</Label>
              <div className="flex items-center space-x-2">
                <Switch
                  id="show-positions"
                  checked={showPositions}
                  onCheckedChange={setShowPositions}
                />
                <Label htmlFor="show-positions" className="text-xs cursor-pointer">
                  Position Lines
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <Switch
                  id="show-trades"
                  checked={showTrades}
                  onCheckedChange={setShowTrades}
                />
                <Label htmlFor="show-trades" className="text-xs cursor-pointer">
                  Trade Dots
                </Label>
              </div>
            </div>

            {/* Symbol Filter */}
            <div className="space-y-2">
              <Label className="text-xs font-semibold">Symbols</Label>
              <div className="flex flex-wrap gap-2">
                {(["BTC", "ETH", "SOL", "BNB", "DOGE"] as TradeSymbol[]).map((symbol) => (
                  <button
                    key={symbol}
                    onClick={() => toggleSymbol(symbol)}
                    className={`px-2 py-1 text-xs rounded transition-colors ${
                      selectedSymbols.has(symbol)
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-muted-foreground hover:bg-muted/80"
                    }`}
                  >
                    {symbol}
                  </button>
                ))}
              </div>
            </div>

            {/* Profitability Filter */}
            <div className="space-y-2">
              <Label className="text-xs font-semibold">Profitability</Label>
              <div className="flex flex-wrap gap-2">
                {(["all", "profitable", "losing"] as const).map((filter) => (
                  <button
                    key={filter}
                    onClick={() => setProfitabilityFilter(filter)}
                    className={`px-2 py-1 text-xs rounded transition-colors capitalize ${
                      profitabilityFilter === filter
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-muted-foreground hover:bg-muted/80"
                    }`}
                  >
                    {filter}
                  </button>
                ))}
              </div>
            </div>

            {/* Trade Type Filter */}
            <div className="space-y-2">
              <Label className="text-xs font-semibold">Trade Types</Label>
              <div className="space-y-1">
                {(["Buy", "Sell", "Hold"] as TradeOperation[]).map((type) => (
                  <div key={type} className="flex items-center space-x-2">
                    <Checkbox
                      id={`trade-type-${type}`}
                      checked={tradeTypeFilter.has(type)}
                      onCheckedChange={() => toggleTradeType(type)}
                    />
                    <Label htmlFor={`trade-type-${type}`} className="text-xs cursor-pointer">
                      {type}
                    </Label>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Chart Controls */}
        <div className="mb-2 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="text-xs text-muted-foreground">
              Scroll: Y-axis zoom • Shift+Scroll: X-axis zoom
            </div>
            {(yZoom !== 1 || xZoom !== 1) && (
              <div className="text-xs font-mono text-blue-600 dark:text-blue-400">
                Y: {yZoom.toFixed(1)}x {xZoom !== 1 && `• X: ${xZoom.toFixed(1)}x`}
              </div>
            )}
          </div>
          <Button
            onClick={resetZoom}
            variant="outline"
            size="sm"
            className="text-xs"
            disabled={yZoom === 1 && xZoom === 1}
          >
            Reset Zoom
          </Button>
        </div>

        {filteredData.length > 0 ? (
          <div ref={chartRef}>
            <ChartContainer
              config={chartConfig}
              className="aspect-auto h-[400px] w-full"
            >
              <LineChart
                accessibilityLayer
                data={zoomFilteredData}
                margin={{
                  left: 8,
                  right: 8,
                  top: 8,
                  bottom: 8,
                }}
              >
                <CartesianGrid vertical={false} />
                <XAxis
                  dataKey="createdAt"
                  tickLine={false}
                  axisLine={false}
                  tickMargin={6}
                  minTickGap={50}
                  tick={{ fontSize: 11 }}
                  tickFormatter={(value) => {
                    const date = new Date(value);
                    return date.toLocaleTimeString("en-US", {
                      hour: "2-digit",
                      minute: "2-digit",
                    });
                  }}
                />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  tickMargin={6}
                  width={70}
                  tick={{ fontSize: 11 }}
                  domain={yDomain}
                  tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`}
                />
                <ChartTooltip
                  content={({ active, payload }) => {
                    if (!active || !payload || !payload.length) {
                      return null;
                    }

                    const data = payload[0].payload as MetricData;
                    const date = new Date(data.createdAt);

                    return (
                      <div className="rounded-lg border bg-background p-3 shadow-xl">
                        <div>
                          <ArcticonsDeepseek className="w-10 h-10 text-blue-500" />
                          <span className="text-sm font-mono font-bold">
                            Deepseek-R1-0528
                          </span>
                        </div>
                        <div className="text-xs text-muted-foreground mb-2">
                          {date.toLocaleString("en-US", {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </div>
                        <div className="space-y-1">
                          <div className="flex items-center justify-between gap-4">
                            <span className="text-sm font-medium">Cash:</span>
                            <span className="text-sm font-mono font-bold">
                              ${data.totalCashValue?.toLocaleString()}
                            </span>
                          </div>
                          <div className="flex items-center justify-between gap-4">
                            <span className="text-sm font-medium">Return:</span>
                            <span
                              className={`text-sm font-mono font-bold ${
                                (data.currentTotalReturn || 0) >= 0
                                  ? "text-green-500"
                                  : "text-red-500"
                              }`}
                            >
                              {((data.currentTotalReturn || 0) * 100).toFixed(2)}%
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  }}
                />

                {/* Position Lines */}
                {positionLines.map(({ positionId, entry, exit }) => (
                  <g key={positionId}>
                    {/* Entry line (green) */}
                    <ReferenceLine
                      x={entry.createdAt}
                      stroke="#22c55e"
                      strokeDasharray="5 5"
                      strokeWidth={2}
                      label={{
                        value: `${entry.symbol} ${entry.leverage}x ENTRY`,
                        position: "top",
                        fill: "#22c55e",
                        fontSize: 10,
                      }}
                    />
                    {/* Exit line (red) */}
                    {exit && (
                      <ReferenceLine
                        x={exit.createdAt}
                        stroke="#ef4444"
                        strokeDasharray="5 5"
                        strokeWidth={2}
                        label={{
                          value: `${exit.symbol} ${exit.leverage}x EXIT`,
                          position: "top",
                          fill: "#ef4444",
                          fontSize: 10,
                        }}
                      />
                    )}
                  </g>
                ))}

                {/* Main Line */}
                <Line
                  dataKey="totalCashValue"
                  type="monotone"
                  stroke={DEEPSEEK_BLUE}
                  strokeWidth={2}
                  dot={(props) => {
                    const { key, ...restProps } = props;
                    return (
                      <CustomDot
                        key={key}
                        {...restProps}
                        dataLength={zoomFilteredData.length}
                      />
                    );
                  }}
                  activeDot={{
                    r: 6,
                    fill: DEEPSEEK_BLUE,
                    stroke: "#fff",
                    strokeWidth: 2,
                  }}
                />

                {/* Trade Dots as ReferenceDots */}
                {tradeDots.map((trade, idx) => (
                  <ReferenceDot
                    key={`trade-dot-${trade.trade.id}-${idx}`}
                    x={trade.createdAt}
                    y={trade.totalCashValue}
                    r={5}
                    fill={
                      trade.operation === "Buy" ? "#22c55e" :
                      trade.operation === "Sell" ? "#ef4444" :
                      "#eab308"
                    }
                    stroke="#fff"
                    strokeWidth={2}
                  />
                ))}
              </LineChart>
            </ChartContainer>
          </div>
        ) : (
          <div className="h-[400px] flex items-center justify-center text-muted-foreground">
            No metrics data available for this time range
          </div>
        )}
      </CardContent>
    </Card>
  );
}
