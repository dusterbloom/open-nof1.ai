"use client";

import { useEffect, useRef, useState, useMemo, useCallback } from "react";
import {
  createChart,
  LineSeries,
  createSeriesMarkers,
  ColorType,
  LineStyle,
  Time,
  SeriesMarker,
  MouseEventParams,
} from "lightweight-charts";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { MetricData } from "@/lib/types/metrics";
import { TradeDetailModal } from "@/components/trade-detail-modal";

// Types
type TradeOperation = "Buy" | "Sell" | "Hold";
type TradeSymbol = "BTC" | "ETH" | "BNB" | "SOL" | "DOGE";
type TimeRange = "ALL" | "72H" | "24H" | "1H";

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

interface LightweightChartProps {
  metricsData: MetricData[];
  loading: boolean;
  lastUpdate: string;
  totalCount?: number;
}

// Constants
const DEEPSEEK_BLUE = "#0066FF";

// Helper: Convert ISO string to Unix timestamp (seconds with decimal precision)
function toUnixTime(isoString: string): Time {
  return (new Date(isoString).getTime() / 1000) as Time;
}

export function LightweightChart({
  metricsData: initialMetricsData,
  loading: initialLoading,
  totalCount: initialTotalCount,
}: LightweightChartProps) {
  // State: Time range and metrics
  const [timeRange, setTimeRange] = useState<TimeRange>("ALL");
  const [metricsData, setMetricsData] = useState<MetricData[]>(initialMetricsData);
  const [loading, setLoading] = useState(initialLoading);
  const [totalCount, setTotalCount] = useState(initialTotalCount);

  // State: Trades
  const [trades, setTrades] = useState<Trade[]>([]);

  // State: Filters
  const [showPositions, setShowPositions] = useState(true);
  const [showTrades, setShowTrades] = useState(true);
  const [selectedSymbols, setSelectedSymbols] = useState<Set<TradeSymbol>>(
    new Set(["BTC", "ETH", "SOL", "BNB", "DOGE"])
  );
  const [profitabilityFilter, setProfitabilityFilter] = useState<"all" | "profitable" | "losing">("all");
  const [tradeTypeFilter, setTradeTypeFilter] = useState<Set<TradeOperation>>(
    new Set(["Buy", "Sell", "Hold"])
  );

  // State: Modal
  const [selectedTrade, setSelectedTrade] = useState<Trade | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Ref: Chart container
  const chartContainerRef = useRef<HTMLDivElement>(null);

  // Sync props with local state when parent updates (real-time data)
  useEffect(() => {
    if (timeRange === "ALL") {
      setMetricsData(initialMetricsData);
      setTotalCount(initialTotalCount);
      setLoading(initialLoading); // Sync loading state from parent
    }
  }, [initialMetricsData, initialTotalCount, initialLoading, timeRange]);

  // Fetch metrics when time range changes
  useEffect(() => {
    const fetchMetrics = async () => {
      if (timeRange === "ALL") return; // Use props for ALL

      setLoading(true);
      try {
        const response = await fetch(`/api/metrics?range=${timeRange}`);
        const result = await response.json();
        if (result.success && result.data) {
          setMetricsData(result.data.metrics || []);
          setTotalCount(result.data.filteredCount || 0);
        }
      } catch (error) {
        console.error("Failed to fetch metrics:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchMetrics();
  }, [timeRange]);

  // Fetch trades once on mount
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

  // Memoized: Filtered trades
  const filteredTrades = useMemo(() => {
    return trades.filter((trade) => {
      // Symbol filter
      if (!selectedSymbols.has(trade.symbol)) return false;

      // Trade type filter
      if (!tradeTypeFilter.has(trade.operation)) return false;

      // Profitability filter
      if (profitabilityFilter !== "all" && trade.positionId) {
        const buyTrade = trades.find(
          (t) => t.positionId === trade.positionId && t.operation === "Buy"
        );
        const sellTrade = trades.find(
          (t) => t.positionId === trade.positionId && t.operation === "Sell"
        );

        if (buyTrade && sellTrade && buyTrade.pricing && sellTrade.pricing) {
          const isProfitable = sellTrade.pricing > buyTrade.pricing;
          if (profitabilityFilter === "profitable" && !isProfitable) return false;
          if (profitabilityFilter === "losing" && isProfitable) return false;
        }
      }

      return true;
    });
  }, [trades, selectedSymbols, profitabilityFilter, tradeTypeFilter]);

  // Memoized: Position lines (entry/exit pairs)
  const positionLines = useMemo(() => {
    const lines: Array<{
      positionId: string;
      entry: Trade;
      exit?: Trade;
    }> = [];

    filteredTrades.forEach((trade) => {
      if (!trade.positionId) return;

      const existingLine = lines.find((l) => l.positionId === trade.positionId);

      if (trade.operation === "Buy") {
        if (!existingLine) {
          lines.push({ positionId: trade.positionId, entry: trade });
        }
      } else if (trade.operation === "Sell") {
        if (existingLine) {
          existingLine.exit = trade;
        }
      }
    });

    return lines;
  }, [filteredTrades]);

  // Memoized: Chart data (transformed from metrics)
  const chartData = useMemo(() => {
    return metricsData
      .map((metric) => ({
        time: toUnixTime(metric.createdAt),
        value: metric.totalCashValue,
      }))
      .sort((a, b) => (a.time as number) - (b.time as number));
  }, [metricsData]);

  // Memoized: Trade markers
  const markers = useMemo((): SeriesMarker<Time>[] => {
    if (!showTrades) return [];

    return filteredTrades.map((trade) => ({
      time: toUnixTime(trade.createdAt),
      position:
        trade.operation === "Buy"
          ? "belowBar"
          : trade.operation === "Sell"
          ? "aboveBar"
          : "inBar",
      color:
        trade.operation === "Buy"
          ? "#22c55e"
          : trade.operation === "Sell"
          ? "#ef4444"
          : "#eab308",
      shape: "circle",
      text: `${trade.symbol} ${trade.leverage}x`,
    }));
  }, [filteredTrades, showTrades]);

  // Click handler
  const handleChartClick = useCallback(
    (param: MouseEventParams) => {
      if (!param.time) return;

      const clickedTime = param.time as number;
      const clickedTrade = filteredTrades.find((trade) => {
        const tradeTime = toUnixTime(trade.createdAt) as number;
        return Math.abs(tradeTime - clickedTime) < 10; // Within 10 seconds
      });

      if (clickedTrade) {
        setSelectedTrade(clickedTrade);
        setIsModalOpen(true);
      }
    },
    [filteredTrades]
  );

  // Main Chart Effect: Initialize/update chart when dependencies change
  useEffect(() => {
    if (!chartContainerRef.current || chartData.length === 0) return;

    // Create chart
    const chart = createChart(chartContainerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: "transparent" },
        textColor: "#9ca3af",
      },
      grid: {
        vertLines: { color: "#1f2937" },
        horzLines: { color: "#1f2937" },
      },
      width: chartContainerRef.current.clientWidth,
      height: 400,
      timeScale: {
        timeVisible: true,
        secondsVisible: false,
        borderColor: "#374151",
      },
      rightPriceScale: {
        borderColor: "#374151",
      },
      crosshair: {
        mode: 0,
        vertLine: {
          width: 1,
          color: "#9ca3af",
          style: LineStyle.Dashed,
        },
        horzLine: {
          width: 1,
          color: "#9ca3af",
          style: LineStyle.Dashed,
        },
      },
    });

    // Create line series
    const lineSeries = chart.addSeries(LineSeries, {
      color: DEEPSEEK_BLUE,
      lineWidth: 2,
      crosshairMarkerVisible: true,
      crosshairMarkerRadius: 6,
      crosshairMarkerBorderColor: "#fff",
      crosshairMarkerBackgroundColor: DEEPSEEK_BLUE,
      lastValueVisible: true,
      priceLineVisible: true,
    });

    // Set data
    lineSeries.setData(chartData);

    // Add markers (createSeriesMarkers returns a plugin API)
    if (markers.length > 0) {
      createSeriesMarkers(lineSeries, markers);
    }

    // Subscribe to click events
    chart.subscribeClick(handleChartClick);

    // Resize handler
    const handleResize = () => {
      if (chartContainerRef.current) {
        chart.applyOptions({
          width: chartContainerRef.current.clientWidth,
        });
      }
    };
    window.addEventListener("resize", handleResize);

    // Fit content
    chart.timeScale().fitContent();

    // Cleanup: destroy chart and remove listeners
    return () => {
      window.removeEventListener("resize", handleResize);
      chart.remove();
    };
  }, [chartData, markers, handleChartClick]); // Re-create chart when these change

  // Toggle handlers
  const toggleSymbol = (symbol: TradeSymbol) => {
    setSelectedSymbols((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(symbol)) {
        newSet.delete(symbol);
      } else {
        newSet.add(symbol);
      }
      return newSet;
    });
  };

  const toggleTradeType = (type: TradeOperation) => {
    setTradeTypeFilter((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(type)) {
        newSet.delete(type);
      } else {
        newSet.add(type);
      }
      return newSet;
    });
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Total Account Value</CardTitle>
            <CardDescription>
              Real-time tracking • Updates every 10s
              <br />
              {totalCount} of 100 points
            </CardDescription>
          </div>
          <div className="flex gap-2">
            {(["ALL", "72H", "24H", "1H"] as TimeRange[]).map((range) => (
              <button
                key={range}
                onClick={() => setTimeRange(range)}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                  timeRange === range
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted hover:bg-muted/80"
                }`}
              >
                {range}
              </button>
            ))}
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Filters */}
        <div className="grid grid-cols-4 gap-6">
          {/* Display toggles */}
          <div className="space-y-3">
            <h3 className="text-sm font-medium">Display</h3>
            <div className="flex items-center space-x-2">
              <Switch
                id="position-lines"
                checked={showPositions}
                onCheckedChange={setShowPositions}
              />
              <Label htmlFor="position-lines" className="text-sm">
                Position Lines
              </Label>
            </div>
            <div className="flex items-center space-x-2">
              <Switch
                id="trade-dots"
                checked={showTrades}
                onCheckedChange={setShowTrades}
              />
              <Label htmlFor="trade-dots" className="text-sm">
                Trade Dots
              </Label>
            </div>
          </div>

          {/* Symbol filters */}
          <div className="space-y-3">
            <h3 className="text-sm font-medium">Symbols</h3>
            <div className="flex flex-wrap gap-2">
              {(["BTC", "ETH", "SOL", "BNB", "DOGE"] as TradeSymbol[]).map((symbol) => (
                <button
                  key={symbol}
                  onClick={() => toggleSymbol(symbol)}
                  className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                    selectedSymbols.has(symbol)
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted hover:bg-muted/80"
                  }`}
                >
                  {symbol}
                </button>
              ))}
            </div>
          </div>

          {/* Profitability filter */}
          <div className="space-y-3">
            <h3 className="text-sm font-medium">Profitability</h3>
            <div className="flex flex-wrap gap-2">
              {[
                { value: "all", label: "All" },
                { value: "profitable", label: "Profitable" },
                { value: "losing", label: "Losing" },
              ].map((option) => (
                <button
                  key={option.value}
                  onClick={() => setProfitabilityFilter(option.value as typeof profitabilityFilter)}
                  className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                    profitabilityFilter === option.value
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted hover:bg-muted/80"
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          {/* Trade type filters */}
          <div className="space-y-3">
            <h3 className="text-sm font-medium">Trade Types</h3>
            <div className="space-y-2">
              {(["Buy", "Sell", "Hold"] as TradeOperation[]).map((type) => (
                <div key={type} className="flex items-center space-x-2">
                  <Checkbox
                    id={`trade-${type}`}
                    checked={tradeTypeFilter.has(type)}
                    onCheckedChange={() => toggleTradeType(type)}
                  />
                  <Label htmlFor={`trade-${type}`} className="text-sm">
                    {type}
                  </Label>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Chart */}
        {loading ? (
          <div className="h-[400px] flex items-center justify-center text-muted-foreground">
            Loading metrics...
          </div>
        ) : metricsData.length > 0 ? (
          <div ref={chartContainerRef} className="w-full h-[400px]" />
        ) : (
          <div className="h-[400px] flex items-center justify-center text-muted-foreground">
            No metrics data available for this time range
          </div>
        )}

        {/* Trade Detail Modal */}
        <TradeDetailModal
          trade={selectedTrade}
          allTrades={trades}
          open={isModalOpen}
          onOpenChange={setIsModalOpen}
        />
      </CardContent>
    </Card>
  );
}
