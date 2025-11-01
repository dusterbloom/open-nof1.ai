import { NextResponse } from "next/server";
import { dryRunWallet, isDryRunMode } from "@/lib/trading/dry-run-wallet";
import { getCurrentMarketState } from "@/lib/trading/current-market-state";
import { prisma } from "@/lib/prisma";

export const GET = async () => {
  try {
    console.log("[POSITIONS] GET request received");
    console.log("[POSITIONS] Dry-run mode:", isDryRunMode());

    if (!isDryRunMode()) {
      console.log("[POSITIONS] Not in dry-run mode, returning empty");
      return NextResponse.json({
        data: { positions: [] },
        success: true,
        message: "Live trading mode - positions not available via this endpoint",
      });
    }

    // Get positions from dry-run wallet
    let positions = dryRunWallet.getPositions();
    console.log("[POSITIONS] Current wallet positions:", positions.length);

    // If wallet is empty, try to restore positions from database
    if (positions.length === 0) {
      console.log("[POSITIONS] Wallet is empty, attempting to restore from database...");

      // Get all BUY trades (both with and without positionId for legacy support)
      const buyTrades = await prisma.trading.findMany({
        where: {
          operation: "Buy",
          success: true, // Only successful trades
        },
        orderBy: {
          createdAt: "desc",
        },
      });
      console.log(`[POSITIONS] Found ${buyTrades.length} successful BUY trades to check`);

      // Track which symbols we've already restored (only one position per symbol allowed)
      const restoredSymbols = new Set<string>();

      // For each buy trade, check if the position has been fully closed
      for (const trade of buyTrades) {
        // Skip if we've already restored a position for this symbol
        if (restoredSymbols.has(trade.symbol)) {
          console.log(`[POSITIONS] Skipping ${trade.symbol} @ ${trade.pricing} - already restored more recent position`);
          continue;
        }

        const tradeLabel = trade.positionId || `legacy-${trade.symbol}-${trade.createdAt.toISOString()}`;
        console.log(`[POSITIONS] Checking trade: ${tradeLabel}`);
        console.log(`[POSITIONS]   Symbol: ${trade.symbol}, Amount: ${trade.amount}, Price: ${trade.pricing}`);

        let sellTrade;

        if (trade.positionId) {
          // New method: Match by positionId (preferred)
          console.log(`[POSITIONS]   Using positionId matching for ${trade.positionId}`);
          sellTrade = await prisma.trading.findFirst({
            where: {
              operation: "Sell",
              positionId: trade.positionId,
              success: true,
            },
          });
        } else {
          // Legacy method: Match by symbol and time (for trades without positionId)
          console.log(`[POSITIONS]   Using legacy symbol+time matching for ${trade.symbol}`);
          sellTrade = await prisma.trading.findFirst({
            where: {
              operation: "Sell",
              symbol: trade.symbol,
              success: true,
              createdAt: {
                gt: trade.createdAt, // SELL must be after BUY
              },
            },
            orderBy: {
              createdAt: "asc", // Get the earliest SELL after this BUY
            },
          });
        }

        if (sellTrade) {
          console.log(`[POSITIONS]   ❌ Position closed by SELL at ${sellTrade.createdAt.toISOString()}`);
        } else {
          console.log(`[POSITIONS]   ✅ No SELL found - position appears open`);
        }

        // If no sell trade found, position is still open - restore it
        if (!sellTrade && trade.amount && trade.pricing) {
          const positionLabel = trade.positionId || `legacy-${trade.symbol}`;
          console.log(`[POSITIONS] Restoring position ${positionLabel} for ${trade.symbol}`);

          // Restore position to wallet by simulating the buy
          const { buy } = await import("@/lib/trading/buy");
          try {
            const result = await buy({
              symbol: `${trade.symbol}/USDT`,
              size: trade.amount,
              leverage: trade.leverage || 1,
              price: trade.pricing,
            });

            if (result.success) {
              console.log(`[POSITIONS] Successfully restored ${trade.symbol} position`);
              // Mark this symbol as restored so we skip older positions
              restoredSymbols.add(trade.symbol);
            } else {
              console.log(`[POSITIONS] Failed to restore: ${result.error}`);
            }
          } catch (error) {
            console.log(`[POSITIONS] Exception during restore: ${error}`);
          }
        }
      }

      // Refresh positions after restoration
      positions = dryRunWallet.getPositions();
      console.log(`[POSITIONS] Restored ${positions.length} positions from database`);
    }

    // Fetch current prices to calculate unrealized PnL
    const positionsWithPnL = await Promise.all(
      positions.map(async (position) => {
        const marketState = await getCurrentMarketState(position.symbol);
        const currentPrice = marketState.current_price;

        // Calculate unrealized PnL
        const unrealizedPnl = dryRunWallet.calculateUnrealizedPnL(position, currentPrice);
        const pnlPercentage = (unrealizedPnl / (position.size / position.leverage)) * 100;

        return {
          ...position,
          currentPrice,
          unrealizedPnl,
          pnlPercentage,
          margin: position.size / position.leverage,
        };
      })
    );

    return NextResponse.json({
      data: { positions: positionsWithPnL },
      success: true,
    });
  } catch (error) {
    console.error("Error fetching positions:", error);
    return NextResponse.json(
      {
        error: "Failed to fetch positions data",
        success: false,
      },
      { status: 500 }
    );
  }
};
