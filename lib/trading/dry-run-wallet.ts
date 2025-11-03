/**
 * Dry-Run Wallet Simulator
 *
 * Simulates a trading wallet for paper trading without real exchange API calls.
 * Inspired by Freqtrade's dry-run mode.
 */

interface SimulatedPosition {
  symbol: string;
  side: "long" | "short";
  size: number;
  entryPrice: number;
  leverage: number;
  timestamp: number;
  unrealizedPnl?: number;
}

interface SimulatedWalletState {
  balance: number; // USDT balance
  initialBalance: number;
  positions: SimulatedPosition[];
  totalPnL: number;
  trades: Array<{
    symbol: string;
    side: "buy" | "sell";
    size: number;
    price: number;
    timestamp: number;
    pnl?: number;
  }>;
}

class DryRunWallet {
  private static instance: DryRunWallet;
  private state: SimulatedWalletState;

  private constructor() {
    const initialBalance = Number(process.env.START_MONEY) || 10000;
    this.state = {
      balance: initialBalance,
      initialBalance,
      positions: [],
      totalPnL: 0,
      trades: [],
    };
  }

  static getInstance(): DryRunWallet {
    if (!DryRunWallet.instance) {
      DryRunWallet.instance = new DryRunWallet();
    }
    return DryRunWallet.instance;
  }

  /**
   * Reset wallet to initial state (useful for testing)
   */
  reset(): void {
    const initialBalance = Number(process.env.START_MONEY) || 10000;
    this.state = {
      balance: initialBalance,
      initialBalance,
      positions: [],
      totalPnL: 0,
      trades: [],
    };
  }

  /**
   * Get current balance
   */
  getBalance(): number {
    return this.state.balance;
  }

  /**
   * Get all positions
   */
  getPositions(): SimulatedPosition[] {
    return this.state.positions;
  }

  /**
   * Get position for a specific symbol
   */
  getPosition(symbol: string): SimulatedPosition | undefined {
    return this.state.positions.find((p) => p.symbol === symbol);
  }

  /**
   * Calculate unrealized PnL for a position based on current market price
   */
  calculateUnrealizedPnL(position: SimulatedPosition, currentPrice: number): number {
    const priceDiff = position.side === "long"
      ? currentPrice - position.entryPrice
      : position.entryPrice - currentPrice;

    return (priceDiff / position.entryPrice) * position.size * position.leverage;
  }

  /**
   * Calculate liquidation price for a position
   *
   * For perpetual futures with cross margin:
   * - Long: liquidationPrice = entryPrice * (1 - (1 / leverage) + maintenanceMarginRate)
   * - Short: liquidationPrice = entryPrice * (1 + (1 / leverage) - maintenanceMarginRate)
   *
   * Binance maintenance margin rate varies by position size, but we use 0.5% as a safe default
   * for most position sizes on major cryptocurrencies.
   *
   * @param position The position to calculate liquidation price for
   * @returns Liquidation price in USDT
   */
  calculateLiquidationPrice(position: SimulatedPosition): number {
    // Binance maintenance margin rate (0.5% for most positions)
    // This is a conservative estimate - actual rate depends on position tier
    const maintenanceMarginRate = 0.005;

    if (position.side === "long") {
      // Long liquidation: price drops to the point where losses = initial margin
      return position.entryPrice * (1 - (1 / position.leverage) + maintenanceMarginRate);
    } else {
      // Short liquidation: price rises to the point where losses = initial margin
      return position.entryPrice * (1 + (1 / position.leverage) - maintenanceMarginRate);
    }
  }

  /**
   * Calculate distance to liquidation as a percentage
   *
   * @param position The position to check
   * @param currentPrice Current market price
   * @returns Percentage distance to liquidation (positive = safe, negative = past liquidation)
   */
  calculateLiquidationDistance(position: SimulatedPosition, currentPrice: number): number {
    const liquidationPrice = this.calculateLiquidationPrice(position);

    if (position.side === "long") {
      // For longs, liquidation occurs when price drops below liquidation price
      // Distance = (currentPrice - liquidationPrice) / currentPrice
      return ((currentPrice - liquidationPrice) / currentPrice) * 100;
    } else {
      // For shorts, liquidation occurs when price rises above liquidation price
      // Distance = (liquidationPrice - currentPrice) / currentPrice
      return ((liquidationPrice - currentPrice) / currentPrice) * 100;
    }
  }

  /**
   * Update position's unrealized PnL
   */
  updatePositionPnL(symbol: string, currentPrice: number): void {
    const position = this.getPosition(symbol);
    if (position) {
      position.unrealizedPnl = this.calculateUnrealizedPnL(position, currentPrice);
    }
  }

  /**
   * Calculate total account value (balance + locked margin + unrealized PnL)
   */
  getTotalAccountValue(currentPrices: Record<string, number>): number {
    let totalUnrealizedPnL = 0;
    let totalLockedMargin = 0;

    for (const position of this.state.positions) {
      const currentPrice = currentPrices[position.symbol];
      if (currentPrice) {
        totalUnrealizedPnL += this.calculateUnrealizedPnL(position, currentPrice);
      }
      // Add the margin locked in this position (position size / leverage)
      totalLockedMargin += position.size / position.leverage;
    }

    // Total account value = free balance + locked margin + unrealized PnL
    return this.state.balance + totalLockedMargin + totalUnrealizedPnL;
  }

  /**
   * Simulate opening a new position (buy)
   */
  openPosition(params: {
    symbol: string;
    side: "long" | "short";
    size: number; // Position size in USDT
    price: number;
    leverage: number;
  }): { success: boolean; error?: string } {
    const { symbol, side, size, price, leverage } = params;

    // Check if position already exists
    const existingPosition = this.getPosition(symbol);
    if (existingPosition) {
      return {
        success: false,
        error: `Position already exists for ${symbol}`,
      };
    }

    // Check if we have enough balance (considering leverage)
    const requiredMargin = size / leverage;
    if (requiredMargin > this.state.balance) {
      return {
        success: false,
        error: `Insufficient balance. Required: ${requiredMargin} USDT, Available: ${this.state.balance} USDT`,
      };
    }

    // Deduct margin from balance
    this.state.balance -= requiredMargin;

    // Create position
    const position: SimulatedPosition = {
      symbol,
      side,
      size,
      entryPrice: price,
      leverage,
      timestamp: Date.now(),
      unrealizedPnl: 0,
    };

    this.state.positions.push(position);

    // Record trade
    this.state.trades.push({
      symbol,
      side: "buy",
      size,
      price,
      timestamp: Date.now(),
    });

    console.log(`[DRY-RUN] Opened ${side} position: ${symbol} @ ${price} USDT, Size: ${size} USDT, Leverage: ${leverage}x`);

    return { success: true };
  }

  /**
   * Simulate closing a position (sell)
   */
  closePosition(params: {
    symbol: string;
    price: number;
  }): { success: boolean; pnl?: number; error?: string } {
    const { symbol, price } = params;

    const positionIndex = this.state.positions.findIndex((p) => p.symbol === symbol);
    if (positionIndex === -1) {
      return {
        success: false,
        error: `No position found for ${symbol}`,
      };
    }

    const position = this.state.positions[positionIndex];

    // Calculate realized PnL
    const realizedPnL = this.calculateUnrealizedPnL(position, price);

    // Return margin + PnL to balance
    const margin = position.size / position.leverage;
    this.state.balance += margin + realizedPnL;
    this.state.totalPnL += realizedPnL;

    // Remove position
    this.state.positions.splice(positionIndex, 1);

    // Record trade
    this.state.trades.push({
      symbol,
      side: "sell",
      size: position.size,
      price,
      timestamp: Date.now(),
      pnl: realizedPnL,
    });

    console.log(`[DRY-RUN] Closed position: ${symbol} @ ${price} USDT, PnL: ${realizedPnL.toFixed(2)} USDT`);

    return { success: true, pnl: realizedPnL };
  }

  /**
   * Get trading history
   */
  getTradeHistory(): SimulatedWalletState["trades"] {
    return this.state.trades;
  }

  /**
   * Get total PnL
   */
  getTotalPnL(): number {
    return this.state.totalPnL;
  }

  /**
   * Get performance metrics
   */
  getPerformanceMetrics(currentPrices: Record<string, number>) {
    const totalValue = this.getTotalAccountValue(currentPrices);
    const totalReturn = ((totalValue - this.state.initialBalance) / this.state.initialBalance) * 100;

    let unrealizedPnL = 0;
    for (const position of this.state.positions) {
      const currentPrice = currentPrices[position.symbol];
      if (currentPrice) {
        unrealizedPnL += this.calculateUnrealizedPnL(position, currentPrice);
      }
    }

    return {
      balance: this.state.balance,
      totalValue,
      unrealizedPnL,
      realizedPnL: this.state.totalPnL,
      totalReturn,
      totalTrades: this.state.trades.length,
      openPositions: this.state.positions.length,
    };
  }

  /**
   * Get full state (for debugging)
   */
  getState(): SimulatedWalletState {
    return this.state;
  }
}

// Export singleton instance
export const dryRunWallet = DryRunWallet.getInstance();

// Helper function to check if dry-run mode is enabled
export function isDryRunMode(): boolean {
  return process.env.TRADING_MODE === "dry_run";
}
