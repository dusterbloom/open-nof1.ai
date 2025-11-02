# Documentation

**Last Updated**: 2025-11-02

Welcome to the open-nof1.ai documentation. This directory contains comprehensive documentation for the metrics chart enhancements and related features.

## Documentation Structure

### Components
Documentation for React components and their usage.

- **[Metrics Chart](./components/METRICS_CHART.md)** - Interactive chart with zoom, filters, and trade visualization
  - Props interface and usage examples
  - Zoom controls (Y-axis and X-axis)
  - Filter system (symbols, profitability, trade types)
  - Trade visualization (dots and position lines)
  - Performance considerations

### API
Documentation for REST API endpoints.

- **[Trades Endpoint](./api/TRADES_ENDPOINT.md)** - `/api/trades` endpoint reference
  - Request/response formats
  - Position linking system
  - TypeScript interfaces
  - Usage examples (fetch, curl, React hooks)
  - Error handling and performance

### UI Components
Documentation for shadcn/ui components used throughout the application.

- **[Shadcn Components](./ui-components/SHADCN_COMPONENTS.md)** - Badge, Checkbox, Label, Switch, Radio Group
  - Component APIs and props
  - Usage in metrics chart filters
  - Styling and theming
  - Accessibility features

### Technical
Deep dives into implementation details and architecture.

- **[Chart Implementation](./technical/CHART_IMPLEMENTATION.md)** - Technical deep dive
  - Architecture overview
  - Data transformation pipeline
  - X-axis zoom implementation (data filtering approach)
  - Coordinate mapping system (trade timestamps → metric timestamps)
  - Why ReferenceDot over Scatter
  - Performance optimizations

## Quick Links

### For Users
- [Metrics Chart User Guide](./components/METRICS_CHART.md#usage-examples)
- [Understanding Filters](./components/METRICS_CHART.md#filter-system)
- [Troubleshooting](./components/METRICS_CHART.md#troubleshooting)

### For Developers
- [Chart Architecture](./technical/CHART_IMPLEMENTATION.md#architecture-overview)
- [Data Pipeline](./technical/CHART_IMPLEMENTATION.md#data-transformation-pipeline)
- [API Integration](./api/TRADES_ENDPOINT.md#usage-examples)
- [Performance Optimization](./technical/CHART_IMPLEMENTATION.md#performance-optimizations)

### For Contributors
- [Component Development](./ui-components/SHADCN_COMPONENTS.md)
- [Testing Guide](./components/METRICS_CHART.md#performance-considerations)
- [Future Enhancements](./technical/CHART_IMPLEMENTATION.md#future-enhancements)

## Feature Overview

### Metrics Chart Enhancements (v1.0.0)

**Released**: 2025-11-02

The metrics chart now includes powerful interactive features for analyzing trading performance:

#### Interactive Zoom
- **Y-Axis**: Scroll to zoom account value range (0.1x - 10x)
- **X-Axis**: Shift+scroll to zoom timeline (0.1x - 10x)
- **Reset**: One-click return to default view

#### Advanced Filtering
- **Symbols**: Toggle BTC, ETH, SOL, BNB, DOGE
- **Profitability**: View all, profitable, or losing trades
- **Trade Types**: Filter Buy, Sell, Hold operations
- **Display**: Show/hide position lines and trade dots

#### Visual Overlays
- **Trade Dots**: Color-coded markers for each operation
  - Green: Buy operations
  - Red: Sell operations
  - Yellow: Hold operations
- **Position Lines**: Vertical lines connecting entry/exit pairs
  - Green dashed: Entry with leverage label
  - Red dashed: Exit with leverage label

### New API Endpoint

**`GET /api/trades`** - Fetch all historical trading operations

```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "symbol": "BTC",
      "operation": "Buy",
      "amount": 0.001,
      "pricing": 45000.50,
      "leverage": 5,
      "positionId": "position-uuid",
      "createdAt": "2025-11-02T10:30:00.000Z",
      "chat": {
        "reasoning": "Market shows strong upward momentum..."
      }
    }
  ]
}
```

### New UI Components

Five shadcn/ui components added for filter interface:
- Badge - Symbol filter chips
- Checkbox - Trade type filters
- Label - Form labels
- Switch - Display toggles
- Radio Group - Profitability filter

## Getting Started

### Reading the Documentation

1. **Start with Component Docs**: Read [Metrics Chart](./components/METRICS_CHART.md) for user-facing features
2. **Understand the API**: Check [Trades Endpoint](./api/TRADES_ENDPOINT.md) for data integration
3. **Learn UI Components**: Browse [Shadcn Components](./ui-components/SHADCN_COMPONENTS.md) for filter interface
4. **Deep Dive**: Explore [Chart Implementation](./technical/CHART_IMPLEMENTATION.md) for architecture details

### Using the Chart

```typescript
import { MetricsChart } from "@/components/metrics-chart";

export default function Dashboard() {
  const [metricsData, setMetricsData] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/metrics")
      .then(res => res.json())
      .then(data => {
        setMetricsData(data.metrics);
        setLoading(false);
      });
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

### Fetching Trades

```typescript
async function fetchTrades() {
  const response = await fetch("/api/trades");
  const result = await response.json();

  if (result.success) {
    return result.data; // Array of trades
  }
}
```

## Key Concepts

### Position Linking

Trades are linked via `positionId` to track complete positions:

- **Entry**: Buy operation with `positionId="pos-123"`
- **Exit**: Sell operation with same `positionId="pos-123"`
- **Profitability**: Compare exit price to entry price

### Coordinate Mapping

Trade dots are positioned using closest timestamp matching:

1. Trade executes at arbitrary time (e.g., 10:37:23)
2. Metrics collected every 20 seconds (e.g., 10:37:20, 10:37:40)
3. System finds closest metric timestamp (10:37:20)
4. Trade dot placed at metric's coordinates

This ensures accurate positioning on Recharts' categorical X-axis.

### X-Axis Zoom Strategy

X-axis zoom uses data filtering instead of domain manipulation:

- Recharts doesn't support domain on categorical axes
- Solution: Slice data array to show subset of points
- Center-focused: Zooming shows middle portion of timeline
- Example: 2.0x zoom shows middle 50% of data points

## Technical Stack

- **Recharts**: Chart library built on D3.js
- **React**: Hooks (useState, useEffect, useMemo, useRef)
- **TypeScript**: Full type safety
- **Tailwind CSS v4**: Styling
- **shadcn/ui**: UI components (Radix UI primitives)
- **Next.js 15**: App Router with Turbopack
- **Prisma**: Database ORM

## Performance

The chart is optimized for large datasets:

- **Tested**: 5000 metrics, 500 trades
- **Memoization**: All expensive calculations cached
- **Early Returns**: Skip computation when filters disabled
- **Data Slicing**: Reduce rendered elements with zoom
- **Typical Render**: <20ms for 1000 points

## Browser Support

- Chrome/Edge 90+
- Firefox 88+
- Safari 14+

Requires JavaScript and CSS Grid support.

## Contributing

When adding features or fixing bugs:

1. **Update Documentation**: Keep docs in sync with code
2. **Add Examples**: Include usage examples
3. **Test Performance**: Verify with large datasets
4. **Follow Patterns**: Use existing memoization and state management patterns

## Versioning

All documentation files include version numbers:

- **Current Version**: 1.0.0
- **Release Date**: 2025-11-02

## Support

For questions or issues:

1. Check [Troubleshooting](./components/METRICS_CHART.md#troubleshooting)
2. Review [Edge Cases](./technical/CHART_IMPLEMENTATION.md#edge-cases-and-solutions)
3. Read [API Errors](./api/TRADES_ENDPOINT.md#error-handling)

## External Resources

- [Recharts Documentation](https://recharts.org/)
- [shadcn/ui Documentation](https://ui.shadcn.com/)
- [Radix UI Primitives](https://www.radix-ui.com/)
- [Tailwind CSS v4](https://tailwindcss.com/)

## License

Same as main project license.

---

**Last Updated**: 2025-11-02 | **Version**: 1.0.0
