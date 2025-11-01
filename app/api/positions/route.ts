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

      // Get all unique open positions by finding BUY trades that are either:
      // 1. Have no corresponding SELL trade with the same positionId
      // 2. Have only partial SELLs (for future implementation)
      const buyTrades = await prisma.trading.findMany({
        where: {
          operation: "Buy",
          success: true, // Only successful trades
          positionId: {
            not: null, // Only trades with positionId (newer trades)
          },
        },
        orderBy: {
          createdAt: "desc",
        },
      });

      // For each buy trade, check if the position has been fully closed
      for (const trade of buyTrades) {
        if (!trade.positionId) continue; // Skip trades without positionId

        // Check if this position has been fully closed (100% sell)
        const sellTrade = await prisma.trading.findFirst({
          where: {
            operation: "Sell",
            positionId: trade.positionId, // Match by positionId
            success: true,
          },
        });

        // If no sell trade found with this positionId, position is still open - restore it
        if (!sellTrade && trade.amount && trade.pricing) {
          console.log(`[POSITIONS] Restoring position ${trade.positionId} for ${trade.symbol}`);

          // Restore position to wallet by simulating the buy
          const { buy } = await import("@/lib/trading/buy");
          try {
            await buy({
              symbol: `${trade.symbol}/USDT`,
              size: trade.amount,
              leverage: trade.leverage || 1,
              price: trade.pricing,
            });
            console.log(`[POSITIONS] Successfully restored ${trade.symbol} position`);
          } catch (error) {
            // Ignore errors if position already exists
            console.log(`[POSITIONS] Skipping restore: ${error}`);
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
