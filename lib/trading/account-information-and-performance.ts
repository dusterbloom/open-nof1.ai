import { Position } from "ccxt";
import { getSpotExchange, getSwapExchange } from "./exchange-factory";
import { isDryRunMode, dryRunWallet } from "./dry-run-wallet";

export interface AccountInformationAndPerformance {
  currentPositionsValue: number;
  contractValue: number;
  totalCashValue: number;
  availableCash: number;
  currentTotalReturn: number;
  positions: Position[];
  sharpeRatio: number;
}

// REMOVED: createSpotExchange() - now using singleton from exchange-factory

/**
 * Get account information in dry-run mode (simulated)
 */
async function getDryRunAccountInformation(
  initialCapital: number
): Promise<AccountInformationAndPerformance> {
  // Fetch current prices for ALL supported cryptocurrencies using Spot API (no auth required)
  const supportedSymbols = ["BTC/USDT", "ETH/USDT", "SOL/USDT", "BNB/USDT", "DOGE/USDT"];
  const currentPrices: Record<string, number> = {};

  try {
    const spotExchange = getSpotExchange();
    const tickers = await spotExchange.fetchTickers(supportedSymbols);

    for (const symbol of supportedSymbols) {
      currentPrices[symbol] = tickers[symbol]?.last || 0;
    }
  } catch (error) {
    console.warn("[DRY-RUN] Failed to fetch prices, using 0:", error);
    // Fallback: set all prices to 0
    for (const symbol of supportedSymbols) {
      currentPrices[symbol] = 0;
    }
  }

  const simulatedPositions = dryRunWallet.getPositions();
  const balance = dryRunWallet.getBalance();
  const metrics = dryRunWallet.getPerformanceMetrics(currentPrices);

  // Convert simulated positions to CCXT Position format
  const positions: Position[] = simulatedPositions.map((pos) => {
    const currentPrice = currentPrices[pos.symbol] || 0;

    // CRITICAL: Calculate unrealized PnL here since it's not stored in positions
    const unrealizedPnl = dryRunWallet.calculateUnrealizedPnL(pos, currentPrice);

    // Calculate percentage based on margin (not notional size) to get true leveraged %
    const margin = pos.size / pos.leverage;
    const pnlPercentage = margin > 0 ? (unrealizedPnl / margin) * 100 : 0;

    return {
      symbol: pos.symbol,
      contracts: pos.size / (pos.entryPrice || 1),
      contractSize: 1,
      unrealizedPnl: unrealizedPnl, // Use calculated value, not stored 0
      leverage: pos.leverage,
      liquidationPrice: 0, // Not calculated in simulation
      collateral: pos.size / pos.leverage,
      notional: pos.size,
      markPrice: currentPrice,
      entryPrice: pos.entryPrice,
      timestamp: pos.timestamp,
      isolated: false,
      side: pos.side === "long" ? "long" : "short",
      percentage: pnlPercentage, // Correct percentage based on margin
      info: {},
      initialMargin: pos.size / pos.leverage,
      initialMarginPercentage: 1 / pos.leverage,
      maintenanceMargin: 0,
      maintenanceMarginPercentage: 0,
      marginRatio: 0,
      datetime: new Date(pos.timestamp).toISOString(),
      marginMode: "cross",
      marginType: "cross",
      hedged: false,
    };
  });

  const currentPositionsValue = positions.reduce((acc, position) => {
    return acc + (position.initialMargin || 0) + (position.unrealizedPnl || 0);
  }, 0);

  const contractValue = positions.reduce((acc, position) => {
    return acc + (position.contracts || 0);
  }, 0);

  const totalCashValue = metrics.totalValue;
  const availableCash = balance;
  const currentTotalReturn = (totalCashValue - initialCapital) / initialCapital;

  const unrealizedPnlSum = positions.reduce((acc, position) => {
    return acc + (position.unrealizedPnl || 0);
  }, 0);

  const sharpeRatio =
    unrealizedPnlSum !== 0
      ? currentTotalReturn / (unrealizedPnlSum / initialCapital)
      : 0;

  console.log(`[DRY-RUN] Account Value: ${totalCashValue.toFixed(2)} USDT, Return: ${(currentTotalReturn * 100).toFixed(2)}%`);

  return {
    currentPositionsValue,
    contractValue,
    totalCashValue,
    availableCash,
    currentTotalReturn,
    positions,
    sharpeRatio,
  };
}

/**
 * Get account information from live exchange
 */
async function getLiveAccountInformation(
  initialCapital: number
): Promise<AccountInformationAndPerformance> {
  const binance = getSwapExchange();
  const positions = await binance.fetchPositions([
    "BTC/USDT",
    "ETH/USDT",
    "SOL/USDT",
    "BNB/USDT",
    "DOGE/USDT",
  ]);
  const currentPositionsValue = positions.reduce((acc, position) => {
    return acc + (position.initialMargin || 0) + (position.unrealizedPnl || 0);
  }, 0);
  const contractValue = positions.reduce((acc, position) => {
    return acc + (position.contracts || 0);
  }, 0);
  const currentCashValue = await binance.fetchBalance({ type: "future" });
  const totalCashValue = currentCashValue.USDT.total || 0;
  const availableCash = currentCashValue.USDT.free || 0;
  const currentTotalReturn = (totalCashValue - initialCapital) / initialCapital;

  // Calculate Sharpe ratio with division by zero protection (same as dry-run mode)
  const unrealizedPnlSum = positions.reduce((acc, position) => {
    return acc + (position.unrealizedPnl || 0);
  }, 0);

  const sharpeRatio =
    unrealizedPnlSum !== 0 && initialCapital !== 0
      ? currentTotalReturn / (Math.abs(unrealizedPnlSum) / initialCapital)
      : 0;

  return {
    currentPositionsValue,
    contractValue,
    totalCashValue,
    availableCash,
    currentTotalReturn,
    positions,
    sharpeRatio,
  };
}

/**
 * Get account information and performance
 * Automatically uses dry-run simulation or live exchange based on TRADING_MODE
 */
export async function getAccountInformationAndPerformance(
  initialCapital: number
): Promise<AccountInformationAndPerformance> {
  if (isDryRunMode()) {
    return getDryRunAccountInformation(initialCapital);
  } else {
    return getLiveAccountInformation(initialCapital);
  }
}

export function formatAccountPerformance(
  accountPerformance: AccountInformationAndPerformance
) {
  const { currentTotalReturn, availableCash, totalCashValue, positions } =
    accountPerformance;

  const output = `## HERE IS YOUR ACCOUNT INFORMATION & PERFORMANCE
Current Total Return (percent): ${currentTotalReturn * 100}%
Available Cash: ${availableCash}
Current Account Value: ${totalCashValue}
Positions: ${positions
    .map((position) =>
      JSON.stringify({
        symbol: position.symbol,
        quantity: position.contracts,
        entry_price: position.entryPrice,
        current_price: position.markPrice,
        liquidation_price: position.liquidationPrice,
        unrealized_pnl_usd: position.unrealizedPnl,
        unrealized_pnl_percentage: position.percentage, // CRITICAL: Include percentage for AI
        leverage: position.leverage,
        notional_usd: position.notional,
        side: position.side,
        margin: position.initialMargin,
        stopLoss: position.stopLossPrice,
        takeProfit: position.takeProfitPrice,
      })
    )
    .join("\n")}`;
  return output;
}
