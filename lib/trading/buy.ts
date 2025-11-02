import { getSpotExchange, getSwapExchange } from "./exchange-factory";
import { isDryRunMode, dryRunWallet } from "./dry-run-wallet";

export interface BuyParams {
  symbol: string;
  size: number; // Position size in USDT
  leverage: number;
  price?: number; // Optional: if not provided, will use market price
}

// REMOVED: createSpotExchange() - now using singleton from exchange-factory

/**
 * Execute a buy order (open long position)
 * In dry-run mode: simulates the trade
 * In live mode: executes on the exchange
 */
export async function buy(params: BuyParams): Promise<{
  success: boolean;
  price?: number;
  error?: string;
}> {
  const { symbol, size, leverage, price } = params;

  // Fetch current market price if not provided
  let executionPrice = price;
  if (!executionPrice) {
    try {
      // Use Spot API for price in dry-run mode (no auth required)
      const exchange = isDryRunMode() ? getSpotExchange() : getSwapExchange();
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
    const result = dryRunWallet.openPosition({
      symbol,
      side: "long",
      size,
      price: executionPrice,
      leverage,
    });

    if (result.success) {
      return {
        success: true,
        price: executionPrice,
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
      const binance = getSwapExchange();

      // Calculate amount in BTC based on USDT size
      const amount = size / executionPrice;

      // Set leverage
      await binance.setLeverage(leverage, symbol);

      // Place market buy order for futures
      const order = await binance.createMarketBuyOrder(symbol, amount, {
        leverage,
      });

      console.log(`[LIVE] Executed buy order:`, order);

      return {
        success: true,
        price: order.average || executionPrice,
      };
    } catch (error) {
      console.error(`[LIVE] Buy order failed:`, error);
      return {
        success: false,
        error: `${error}`,
      };
    }
  }
}
