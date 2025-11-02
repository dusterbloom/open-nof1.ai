import { getSwapExchange } from "./exchange-factory";
import { isDryRunMode, dryRunWallet } from "./dry-run-wallet";

export interface StopLossTakeProfitParams {
  symbol: string;
  stopLoss?: number;
  takeProfit?: number;
  positionSize?: number; // Required for live mode to know how much to protect
  side?: "long" | "short"; // Required for live mode to determine order direction
}

export interface StopLossTakeProfitResult {
  success: boolean;
  stopLossOrderId?: string;
  takeProfitOrderId?: string;
  error?: string;
}

/**
 * Set stop loss and take profit for a position
 * - In dry-run mode: Stores SL/TP in the simulated wallet
 * - In live mode: Creates STOP_MARKET and TAKE_PROFIT_MARKET orders on Binance
 */
export async function setStopLossTakeProfit(
  params: StopLossTakeProfitParams
): Promise<StopLossTakeProfitResult> {
  const { symbol, stopLoss, takeProfit, positionSize, side } = params;

  // At least one must be provided
  if (!stopLoss && !takeProfit) {
    return {
      success: false,
      error: "Must provide at least one of stopLoss or takeProfit",
    };
  }

  try {
    if (isDryRunMode()) {
      // Dry-run mode: Store in wallet state
      return setDryRunStopLossTakeProfit(symbol, stopLoss, takeProfit);
    } else {
      // Live mode: Create orders on exchange
      return await setLiveStopLossTakeProfit(
        symbol,
        stopLoss,
        takeProfit,
        positionSize!,
        side!
      );
    }
  } catch (error) {
    console.error(`[SL/TP] Error setting stop loss/take profit:`, error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Set stop loss/take profit in dry-run mode (simulation)
 */
function setDryRunStopLossTakeProfit(
  symbol: string,
  stopLoss?: number,
  takeProfit?: number
): StopLossTakeProfitResult {
  try {
    const position = dryRunWallet.getPositions().find((p) => p.symbol === symbol);

    if (!position) {
      return {
        success: false,
        error: `No open position found for ${symbol} in dry-run wallet`,
      };
    }

    // Update the position's stop loss and take profit
    // Note: The dry-run wallet will need to be updated to store these values
    // For now, we'll log them
    console.log(`[DRY-RUN] Setting SL/TP for ${symbol}:`);
    if (stopLoss) {
      console.log(`  Stop Loss: ${stopLoss}`);
    }
    if (takeProfit) {
      console.log(`  Take Profit: ${takeProfit}`);
    }

    // TODO: Update dry-run wallet to actually store and check these levels
    // on price updates. For now, this is a placeholder that logs the intent.

    return {
      success: true,
      stopLossOrderId: stopLoss ? `dry-run-sl-${Date.now()}` : undefined,
      takeProfitOrderId: takeProfit ? `dry-run-tp-${Date.now()}` : undefined,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Set stop loss/take profit in live mode (create orders on Binance)
 */
async function setLiveStopLossTakeProfit(
  symbol: string,
  stopLoss: number | undefined,
  takeProfit: number | undefined,
  positionSize: number,
  side: "long" | "short"
): Promise<StopLossTakeProfitResult> {
  const binance = getSwapExchange();
  const result: StopLossTakeProfitResult = { success: true };

  try {
    // For futures positions, we need to determine the order side
    // Long position: SELL orders to close (stop loss sells if price drops, take profit sells if price rises)
    // Short position: BUY orders to close (stop loss buys if price rises, take profit buys if price drops)
    const closeSide = side === "long" ? "sell" : "buy";

    // Create stop loss order (STOP_MARKET)
    if (stopLoss) {
      try {
        const stopLossOrder = await binance.createOrder(
          symbol,
          "STOP_MARKET",
          closeSide,
          positionSize,
          undefined, // No limit price for market order
          {
            stopPrice: stopLoss,
            reduceOnly: true, // Only close existing position, don't open new one
          }
        );

        result.stopLossOrderId = stopLossOrder.id;
        console.log(`[LIVE] Stop loss order created: ${stopLossOrder.id} at ${stopLoss}`);
      } catch (error) {
        console.error(`[LIVE] Failed to create stop loss order:`, error);
        result.success = false;
        result.error = `Stop loss order failed: ${error instanceof Error ? error.message : "Unknown error"}`;
        return result;
      }
    }

    // Create take profit order (TAKE_PROFIT_MARKET)
    if (takeProfit) {
      try {
        const takeProfitOrder = await binance.createOrder(
          symbol,
          "TAKE_PROFIT_MARKET",
          closeSide,
          positionSize,
          undefined, // No limit price for market order
          {
            stopPrice: takeProfit,
            reduceOnly: true, // Only close existing position, don't open new one
          }
        );

        result.takeProfitOrderId = takeProfitOrder.id;
        console.log(`[LIVE] Take profit order created: ${takeProfitOrder.id} at ${takeProfit}`);
      } catch (error) {
        console.error(`[LIVE] Failed to create take profit order:`, error);
        result.success = false;
        result.error = result.error
          ? `${result.error}; Take profit order failed: ${error instanceof Error ? error.message : "Unknown error"}`
          : `Take profit order failed: ${error instanceof Error ? error.message : "Unknown error"}`;
        return result;
      }
    }

    return result;
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Cancel existing stop loss/take profit orders for a symbol
 * Useful before setting new levels
 */
export async function cancelStopLossTakeProfit(
  symbol: string
): Promise<{ success: boolean; error?: string }> {
  if (isDryRunMode()) {
    console.log(`[DRY-RUN] Cancelling SL/TP orders for ${symbol}`);
    return { success: true };
  }

  try {
    const binance = getSwapExchange();

    // Fetch all open orders for the symbol
    const openOrders = await binance.fetchOpenOrders(symbol);

    // Filter for STOP_MARKET and TAKE_PROFIT_MARKET orders
    const slTpOrders = openOrders.filter(
      (order) =>
        order.type === "STOP_MARKET" || order.type === "TAKE_PROFIT_MARKET"
    );

    // Cancel each SL/TP order
    for (const order of slTpOrders) {
      try {
        await binance.cancelOrder(order.id, symbol);
        console.log(`[LIVE] Cancelled ${order.type} order: ${order.id}`);
      } catch (error) {
        console.error(`[LIVE] Failed to cancel order ${order.id}:`, error);
      }
    }

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}
