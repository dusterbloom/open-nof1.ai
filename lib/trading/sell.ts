import { binance } from "./binance";
import { isDryRunMode, dryRunWallet } from "./dry-run-wallet";

export interface SellParams {
  symbol: string;
  percentage?: number; // Percentage of position to sell (default: 100%)
  price?: number; // Optional: if not provided, will use market price
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
 * Execute a sell order (close long position)
 * In dry-run mode: simulates the trade
 * In live mode: executes on the exchange
 */
export async function sell(params: SellParams): Promise<{
  success: boolean;
  price?: number;
  pnl?: number;
  error?: string;
}> {
  const { symbol, percentage = 100, price } = params;

  // Fetch current market price if not provided
  let executionPrice = price;
  if (!executionPrice) {
    try {
      // Use Spot API for price in dry-run mode (no auth required)
      const exchange = isDryRunMode() ? createSpotExchange() : binance;
      const ticker = await exchange.fetchTicker(symbol);
      executionPrice = ticker.last || 0;
    } catch (error) {
      return {
        success: false,
        error: `Failed to fetch market price: ${error}`,
      };
    }
  }

  if (isDryRunMode()) {
    // Dry-run mode: simulate the trade
    if (percentage !== 100) {
      return {
        success: false,
        error: "Partial sells not yet supported in dry-run mode",
      };
    }

    const result = dryRunWallet.closePosition({
      symbol,
      price: executionPrice,
    });

    if (result.success) {
      return {
        success: true,
        price: executionPrice,
        pnl: result.pnl,
      };
    } else {
      return {
        success: false,
        error: result.error,
      };
    }
  } else {
    // Live mode: execute on exchange
    try {
      // Fetch current position
      const positions = await binance.fetchPositions([symbol]);
      const position = positions.find((p) => p.symbol === symbol);

      if (!position || !position.contracts) {
        return {
          success: false,
          error: `No open position found for ${symbol}`,
        };
      }

      // Calculate amount to sell based on percentage
      const amount = (position.contracts * percentage) / 100;

      // Place market sell order for futures
      const order = await binance.createMarketSellOrder(symbol, amount);

      console.log(`[LIVE] Executed sell order:`, order);

      return {
        success: true,
        price: order.average || executionPrice,
      };
    } catch (error) {
      console.error(`[LIVE] Sell order failed:`, error);
      return {
        success: false,
        error: `${error}`,
      };
    }
  }
}
