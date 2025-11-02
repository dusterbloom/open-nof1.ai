# Metrics Chart Component

**Last Updated**: 2025-11-02
**Component**: `components/metrics-chart.tsx`
**Version**: 1.0.0

## Overview

The `MetricsChart` component is an interactive, real-time visualization of account performance and trading activity. It combines time-series account value data with trading operations overlays, providing a comprehensive view of AI-driven trading decisions and their impact on account performance.

## Table of Contents

- [Features](#features)
- [Props Interface](#props-interface)
- [Zoom Controls](#zoom-controls)
- [Filter System](#filter-system)
- [Trade Visualization](#trade-visualization)
- [Technical Implementation](#technical-implementation)
- [Usage Examples](#usage-examples)
- [Performance Considerations](#performance-considerations)

## Features

### Interactive Zoom
- **Y-Axis Zoom**: Mouse scroll wheel (0.1x - 10x range)
- **X-Axis Zoom**: Shift + scroll wheel (0.1x - 10x range)
- **Reset Button**: One-click return to default zoom (1.0x/1.0x)

### Advanced Filtering
- **Symbol Filter**: Toggle visibility by cryptocurrency (BTC, ETH, SOL, BNB, DOGE)
- **Profitability Filter**: View All/Profitable/Losing trades
- **Trade Type Filter**: Show/hide Buy, Sell, and Hold operations
- **Display Toggles**: Control position lines and trade dots independently

### Visual Overlays
- **Trade Dots**: Color-coded operation markers
  - Green: Buy operations
  - Red: Sell operations
  - Yellow: Hold operations
- **Position Lines**: Dashed vertical lines connecting entry/exit pairs
  - Green: Entry (Buy) with leverage label
  - Red: Exit (Sell) with leverage label

### Time Range Selection
- ALL: Complete historical data
- 72H: Last 72 hours
- 24H: Last 24 hours
- 1H: Last hour

## Props Interface

```typescript
interface MetricsChartProps {
  metricsData: MetricData[];      // Time-series account value data
  loading: boolean;                // Loading state indicator
  lastUpdate: string;              // ISO timestamp of last data update
  totalCount?: number;             // Total count of metrics in database
}

interface MetricData {
  id: string;
  createdAt: string;               // ISO timestamp
  totalCashValue: number;          // Account value in USDT
  currentTotalReturn: number;      // Return as decimal (0.05 = 5%)
  // Additional fields...
}
```

## Zoom Controls

### Y-Axis Zoom (Vertical)

Controls the visible range of account values on the Y-axis.

**Usage**:
- Scroll wheel up: Zoom in (increase detail)
- Scroll wheel down: Zoom out (see broader range)

**Implementation**:
```typescript
const yDomain = useMemo(() => {
  const values = zoomFilteredData.map(d => d.totalCashValue);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const padding = (max - min) * 0.1 / yZoom;  // Padding inversely proportional to zoom

  return [
    Math.max(0, min - padding),
    max + padding
  ];
}, [zoomFilteredData, yZoom]);
```

**Behavior**:
- Zoom level affects the dynamic domain calculation
- Higher zoom = tighter Y-axis range around data points
- Minimum value is always >= 0 (account value can't be negative)
- 10% padding is applied, scaled by zoom level

### X-Axis Zoom (Horizontal)

Controls the number of visible data points on the timeline.

**Usage**:
- Shift + scroll wheel up: Zoom in (fewer points, more detail)
- Shift + scroll wheel down: Zoom out (more points, broader timeline)

**Implementation**:
```typescript
const zoomFilteredData = useMemo(() => {
  if (xZoom === 1) return filteredData;

  const totalPoints = filteredData.length;
  const visiblePoints = Math.ceil(totalPoints / xZoom);
  const startIndex = Math.floor((totalPoints - visiblePoints) / 2);

  return filteredData.slice(startIndex, startIndex + visiblePoints);
}, [filteredData, xZoom]);
```

**Why Data Filtering Instead of Domain?**

Recharts doesn't support domain manipulation on categorical X-axes (time-based discrete points). Instead, we slice the data array to show a subset of points centered in the timeline.

**Behavior**:
- At 1.0x: All filtered data is visible
- At 2.0x: Middle 50% of points are shown
- At 10.0x: Middle 10% of points are shown
- Zoom focuses on the center of the dataset

### Reset Zoom

The reset button returns both axes to their default state (1.0x zoom).

```typescript
const resetZoom = () => {
  setYZoom(1);
  setXZoom(1);
};
```

The button is disabled when already at default zoom levels.

## Filter System

### Architecture Overview

The filter system uses a multi-stage data transformation pipeline:

```
Raw Trades → filteredTrades → tradeDots → Rendered ReferenceDots
                    ↓
            positionLines → Rendered ReferenceLines
```

### State Management

```typescript
// Display toggles
const [showPositions, setShowPositions] = useState(true);
const [showTrades, setShowTrades] = useState(true);

// Filter criteria
const [selectedSymbols, setSelectedSymbols] = useState<Set<TradeSymbol>>(
  new Set(["BTC", "ETH", "BNB", "SOL", "DOGE"])
);
const [profitabilityFilter, setProfitabilityFilter] = useState<"all" | "profitable" | "losing">("all");
const [tradeTypeFilter, setTradeTypeFilter] = useState<Set<TradeOperation>>(
  new Set(["Buy", "Sell", "Hold"])
);
```

### Filter Logic

#### Symbol Filter

Simple set membership check:

```typescript
if (!selectedSymbols.has(trade.symbol)) return false;
```

#### Trade Type Filter

Filters based on operation type:

```typescript
if (!tradeTypeFilter.has(trade.operation)) return false;
```

#### Profitability Filter

Complex filter requiring position matching:

```typescript
if (profitabilityFilter !== "all" && trade.positionId) {
  const openTrade = trades.find(t =>
    t.positionId === trade.positionId && t.operation === "Buy"
  );
  const closeTrade = trades.find(t =>
    t.positionId === trade.positionId && t.operation === "Sell"
  );

  if (openTrade && closeTrade && openTrade.pricing && closeTrade.pricing) {
    const isProfitable = closeTrade.pricing > openTrade.pricing;
    if (profitabilityFilter === "profitable" && !isProfitable) return false;
    if (profitabilityFilter === "losing" && isProfitable) return false;
  }
}
```

**Logic Explanation**:
1. Only applies to trades with `positionId` (completed positions)
2. Finds the Buy (entry) and Sell (exit) trades for the position
3. Compares exit price to entry price
4. Profitable: Exit price > Entry price
5. Losing: Exit price <= Entry price

### Data Flow

```typescript
// Step 1: Filter trades based on all criteria
const filteredTrades = useMemo(() => {
  return trades.filter(trade => {
    // Apply symbol, type, and profitability filters
    // ...
  });
}, [trades, selectedSymbols, profitabilityFilter, tradeTypeFilter]);

// Step 2: Calculate position lines from filtered trades
const positionLines = useMemo(() => {
  if (!showPositions) return [];

  // Group trades by positionId
  // Extract entry/exit pairs
  // ...
}, [filteredTrades, showPositions]);

// Step 3: Map trades to chart coordinates
const tradeDots = useMemo(() => {
  if (!showTrades) return [];

  return filteredTrades.map(trade => {
    // Find closest metric timestamp
    // Map to chart coordinates
    // ...
  });
}, [filteredTrades, zoomFilteredData, showTrades]);
```

## Trade Visualization

### Trade Dots

Trade dots use Recharts `ReferenceDot` components to mark exact trade execution times on the chart.

**Color Coding**:
```typescript
fill={
  trade.operation === "Buy" ? "#22c55e" :    // Green
  trade.operation === "Sell" ? "#ef4444" :   // Red
  "#eab308"                                   // Yellow (Hold)
}
```

**Coordinate Mapping**:

The critical challenge is mapping trade timestamps to chart coordinates. Since trades execute at arbitrary times and metrics are collected at fixed intervals (every 20 seconds), we must find the closest metric timestamp:

```typescript
const tradeDots = useMemo(() => {
  return filteredTrades.map(trade => {
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
      createdAt: closestMetric.createdAt,  // Use metric timestamp for exact match
      totalCashValue: closestMetric?.totalCashValue || 0,
      operation: trade.operation,
      symbol: trade.symbol,
      leverage: trade.leverage,
      trade,
    };
  });
}, [filteredTrades, zoomFilteredData, showTrades]);
```

**Why This Approach?**

Recharts requires exact coordinate matches for ReferenceDots on categorical axes. By using the closest metric's timestamp, we guarantee the dot appears exactly on a data point on the chart.

**Rendering**:
```typescript
{tradeDots.map((trade, idx) => (
  <ReferenceDot
    key={`trade-dot-${trade.trade.id}-${idx}`}
    x={trade.createdAt}           // Metric timestamp (exact match)
    y={trade.totalCashValue}      // Account value at that time
    r={5}
    fill={/* operation color */}
    stroke="#fff"
    strokeWidth={2}
  />
))}
```

### Position Lines

Position lines connect Buy/Sell pairs using vertical dashed lines.

**Position Matching**:

```typescript
const positionLines = useMemo(() => {
  const lines: Array<{
    positionId: string;
    entry: Trade;
    exit: Trade | null;
  }> = [];

  const positionMap = new Map<string, { entry: Trade | null; exit: Trade | null }>();

  // Group trades by positionId
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

  // Convert to array of positions with entries
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
```

**Rendering**:

```typescript
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
```

**Visual Design**:
- Entry: Green dashed line with "SYMBOL LEVERAGEx ENTRY" label
- Exit: Red dashed line with "SYMBOL LEVERAGEx EXIT" label
- Labels positioned at top of chart for visibility
- Dashed pattern (5px dash, 5px gap) for distinction from grid lines

## Technical Implementation

### Recharts Configuration

The chart uses Recharts library with custom configurations:

```typescript
<ChartContainer config={chartConfig} className="aspect-auto h-[400px] w-full">
  <LineChart
    accessibilityLayer
    data={zoomFilteredData}
    margin={{ left: 8, right: 8, top: 8, bottom: 8 }}
  >
    <CartesianGrid vertical={false} />
    <XAxis
      dataKey="createdAt"
      tickFormatter={(value) => {
        const date = new Date(value);
        return date.toLocaleTimeString("en-US", {
          hour: "2-digit",
          minute: "2-digit",
        });
      }}
    />
    <YAxis
      domain={yDomain}
      tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`}
    />
    {/* ... */}
  </LineChart>
</ChartContainer>
```

### Custom Dot Component

The last data point features a custom animated dot with DeepSeek branding:

```typescript
const CustomDot = (props: CustomDotProps) => {
  const { cx, cy, index, payload, dataLength } = props;

  // Only show on last point
  if (!payload || !cx || !cy || index !== dataLength - 1) {
    return null;
  }

  return (
    <g>
      {/* Animated ping circle */}
      <circle
        cx={cx} cy={cy} r={20}
        fill={DEEPSEEK_BLUE}
        opacity={0.2}
        className="animate-ping"
      />
      {/* Main dot */}
      <circle
        cx={cx} cy={cy} r={8}
        fill={DEEPSEEK_BLUE}
        stroke="#fff"
        strokeWidth={2}
      />
      {/* Logo and price via foreignObject */}
      <foreignObject x={cx + 15} y={cy - 30} width={180} height={60}>
        {/* React component for logo + price */}
      </foreignObject>
    </g>
  );
};
```

**Why foreignObject?**

SVG context requires either pure SVG elements or `foreignObject` to embed HTML/React components. The DeepSeek logo component is React-based, so we use `foreignObject` for the label portion.

### Mouse Wheel Event Handling

```typescript
useEffect(() => {
  const handleWheel = (e: WheelEvent) => {
    if (!chartRef.current?.contains(e.target as Node)) {
      return;  // Ignore events outside chart
    }

    e.preventDefault();  // Prevent page scroll
    const delta = e.deltaY > 0 ? 0.9 : 1.1;  // 10% zoom per scroll

    if (e.shiftKey) {
      // X-axis zoom
      setXZoom(prev => Math.max(0.1, Math.min(10, prev * delta)));
    } else {
      // Y-axis zoom
      setYZoom(prev => Math.max(0.1, Math.min(10, prev * delta)));
    }
  };

  const chartElement = chartRef.current;
  if (!chartElement) return;

  chartElement.addEventListener("wheel", handleWheel, { passive: false });

  return () => {
    if (chartElement) {
      chartElement.removeEventListener("wheel", handleWheel);
    }
  };
}, [filteredData.length]);
```

**Key Implementation Details**:
- `passive: false` required to call `preventDefault()`
- Event scoped to chart element using `contains()` check
- Cleanup properly handles element removal
- Re-runs when data changes to ensure element exists

## Usage Examples

### Basic Usage

```typescript
import { MetricsChart } from "@/components/metrics-chart";

export default function DashboardPage() {
  const [metricsData, setMetricsData] = useState<MetricData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchMetrics() {
      const response = await fetch("/api/metrics");
      const data = await response.json();
      setMetricsData(data.metrics);
      setLoading(false);
    }
    fetchMetrics();
  }, []);

  return (
    <MetricsChart
      metricsData={metricsData}
      loading={loading}
      lastUpdate={new Date().toISOString()}
      totalCount={metricsData.length}
    />
  );
}
```

### With Auto-Refresh

```typescript
export default function LiveDashboard() {
  const [metricsData, setMetricsData] = useState<MetricData[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState(new Date().toISOString());

  useEffect(() => {
    async function fetchMetrics() {
      try {
        const response = await fetch("/api/metrics");
        const data = await response.json();
        setMetricsData(data.metrics);
        setLastUpdate(new Date().toISOString());
      } catch (error) {
        console.error("Failed to fetch metrics:", error);
      } finally {
        setLoading(false);
      }
    }

    // Initial fetch
    fetchMetrics();

    // Refresh every 20 seconds
    const interval = setInterval(fetchMetrics, 20000);

    return () => clearInterval(interval);
  }, []);

  return (
    <MetricsChart
      metricsData={metricsData}
      loading={loading}
      lastUpdate={lastUpdate}
      totalCount={metricsData.length}
    />
  );
}
```

## Performance Considerations

### Memoization Strategy

All expensive calculations are memoized to prevent unnecessary recalculations:

```typescript
// Data filtering (depends on timeRange and raw data)
const filteredData = useMemo(() => { /* ... */ }, [metricsData, timeRange]);

// Trade filtering (depends on all filter states)
const filteredTrades = useMemo(() => { /* ... */ },
  [trades, selectedSymbols, profitabilityFilter, tradeTypeFilter]
);

// Zoom filtering (depends on filtered data and zoom level)
const zoomFilteredData = useMemo(() => { /* ... */ }, [filteredData, xZoom]);

// Position lines (depends on filtered trades and toggle)
const positionLines = useMemo(() => { /* ... */ }, [filteredTrades, showPositions]);

// Trade dots (depends on filtered trades, zoom data, and toggle)
const tradeDots = useMemo(() => { /* ... */ },
  [filteredTrades, zoomFilteredData, showTrades]
);

// Y-axis domain (depends on visible data and zoom)
const yDomain = useMemo(() => { /* ... */ }, [zoomFilteredData, yZoom]);
```

### Large Dataset Handling

The component efficiently handles large datasets through:

1. **Time Range Filtering**: Reduces data before zoom/render calculations
2. **X-Axis Zoom**: Further reduces visible points for detailed views
3. **Conditional Rendering**: Position lines and trade dots only render when enabled
4. **Early Returns**: Filter logic returns early when conditions fail

### Recommended Limits

- **Metrics Data**: Up to 10,000 points (tested)
- **Trades**: Up to 1,000 trade operations (tested)
- **Concurrent Filters**: All filters can be active simultaneously

For datasets exceeding these limits, consider:
- Server-side pagination
- Data aggregation for older time periods
- Virtual scrolling for trade lists

## Related Documentation

- [Trades API Endpoint](../api/TRADES_ENDPOINT.md) - Backend data source
- [Shadcn UI Components](../ui-components/SHADCN_COMPONENTS.md) - Filter UI components
- [Chart Implementation Deep Dive](../technical/CHART_IMPLEMENTATION.md) - Internal architecture
- [Metrics API](../../app/api/metrics/README.md) - Metrics data endpoint

## Troubleshooting

### Trade Dots Not Appearing

**Symptoms**: Trades exist but don't show on chart

**Possible Causes**:
1. `showTrades` toggle is disabled
2. Trades filtered out by symbol/type/profitability filters
3. Trade timestamp outside current time range
4. No matching metric timestamp (unlikely with 20s collection interval)

**Debug Steps**:
```typescript
console.log("Filtered trades:", filteredTrades.length);
console.log("Trade dots:", tradeDots.length);
console.log("Zoom filtered data:", zoomFilteredData.length);
```

### Position Lines Missing

**Symptoms**: Buy/Sell operations exist but no lines shown

**Possible Causes**:
1. `showPositions` toggle is disabled
2. Trades lack `positionId` field
3. Only Buy or only Sell exists (entry without exit is valid, shows one line)

**Debug Steps**:
```typescript
console.log("Position lines:", positionLines);
console.log("Trades with positionId:", filteredTrades.filter(t => t.positionId));
```

### Zoom Not Working

**Symptoms**: Scroll doesn't zoom chart

**Possible Causes**:
1. Chart ref not attached (element not rendered)
2. Scrolling outside chart boundaries
3. Browser preventing default scroll behavior

**Debug Steps**:
- Check `chartRef.current` is not null
- Verify event listener is attached
- Test with `console.log` in handleWheel

## Version History

- **1.0.0** (2025-11-02): Initial release with zoom, filters, and trade visualization
