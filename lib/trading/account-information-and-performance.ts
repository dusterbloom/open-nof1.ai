import { Position } from "ccxt";
import { binance } from "./binance";
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

/**
 * Create a Binance Spot exchange instance for public data (no auth required)
 */
function createSpotExchange() {
  const ccxt = require("ccxt");
  return new ccxt.binance({
    options: {
      defaultType: "spot",
    },
  });
}

/**
 * Get account information in dry-run mode (simulated)
 */
async function getDryRunAccountInformation(
  initialCapital: number
): Promise<AccountInformationAndPerformance> {
  // Fetch current BTC price for PnL calculation using Spot API (no auth required)
  let currentBtcPrice = 0;
  try {
    const spotExchange = createSpotExchange();
    const ticker = await spotExchange.fetchTicker("BTC/USDT");
    currentBtcPrice = ticker.last || 0;
  } catch (error) {
    console.warn("[DRY-RUN] Failed to fetch BTC price, using 0:", error);
  }

  const simulatedPositions = dryRunWallet.getPositions();
  const balance = dryRunWallet.getBalance();
  const metrics = dryRunWallet.getPerformanceMetrics({
    "BTC/USDT": currentBtcPrice,
  });

  // Convert simulated positions to CCXT Position format
  const positions: Position[] = simulatedPositions.map((pos) => ({
    symbol: pos.symbol,
    contracts: pos.size / (pos.entryPrice || 1),
    contractSize: 1,
    unrealizedPnl: pos.unrealizedPnl || 0,
    leverage: pos.leverage,
    liquidationPrice: 0, // Not calculated in simulation
    collateral: pos.size / pos.leverage,
    notional: pos.size,
    markPrice: currentBtcPrice,
    entryPrice: pos.entryPrice,
    timestamp: pos.timestamp,
    isolated: false,
    side: pos.side === "long" ? "long" : "short",
    percentage: pos.unrealizedPnl ? (pos.unrealizedPnl / pos.size) * 100 : 0,
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
  }));

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
  const positions = await binance.fetchPositions(["BTC/USDT"]);
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
  const sharpeRatio =
    currentTotalReturn /
    (positions.reduce((acc, position) => {
      return acc + (position.unrealizedPnl || 0);
    }, 0) /
      initialCapital);

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
        unrealized_pnl: position.unrealizedPnl,
        leverage: position.leverage,
        notional_usd: position.notional,
        side: position.side,
        stopLoss: position.stopLossPrice,
        takeProfit: position.takeProfitPrice,
      })
    )
    .join("\n")}`;
  return output;
}
