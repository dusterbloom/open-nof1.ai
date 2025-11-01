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
      // Get all BUY trades from database that haven't been closed with a SELL
      const buyTrades = await prisma.trading.findMany({
        where: {
          operation: "Buy",
        },
        orderBy: {
          createdAt: "desc",
        },
      });

      // For each buy trade, check if there's a corresponding sell
      for (const trade of buyTrades) {
        // Check if this position has been closed
        const sellTrade = await prisma.trading.findFirst({
          where: {
            operation: "Sell",
            symbol: trade.symbol,
            createdAt: {
              gt: trade.createdAt,
            },
          },
        });

        // If no sell trade found, this position is still open - restore it
        if (!sellTrade && trade.amount && trade.pricing) {
          // Restore position to wallet by simulating the buy
          const { buy } = await import("@/lib/trading/buy");
          try {
            await buy({
              symbol: `${trade.symbol}/USDT`,
              size: trade.amount,
              leverage: trade.leverage || 1,
              price: trade.pricing,
            });
          } catch (error) {
            // Ignore errors if position already exists
            console.log(`[POSITIONS] Skipping restore: ${error}`);
          }
        }
      }

      // Refresh positions after restoration
      positions = dryRunWallet.getPositions();
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
