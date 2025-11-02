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
    const currentBalance = dryRunWallet.getBalance();
    const currentPnL = dryRunWallet.getTotalPnL();
    console.log("[POSITIONS] Current wallet state:");
    console.log(`[POSITIONS]   Balance: ${currentBalance}`);
    console.log(`[POSITIONS]   Total P&L: ${currentPnL}`);
    console.log(`[POSITIONS]   Positions: ${positions.length}`);

    // If wallet appears uninitialized (balance = initial AND pnl = 0 AND no positions), restore from database
    const startMoney = Number(process.env.START_MONEY) || 10000;
    const walletAppearsUninitialized = currentBalance === startMoney && currentPnL === 0 && positions.length === 0;

    if (walletAppearsUninitialized) {
      console.log("[POSITIONS] Wallet appears uninitialized, attempting full restoration from database...");

      const { restoreDryRunWallet } = await import("@/lib/trading/restore-dry-run-wallet");
      const restorationResult = await restoreDryRunWallet();

      console.log(`[POSITIONS] Restoration complete:`);
      console.log(`[POSITIONS]   Balance: ${restorationResult.balance.toFixed(2)} USDT`);
      console.log(`[POSITIONS]   Total P&L: ${restorationResult.totalPnL.toFixed(2)} USDT`);
      console.log(`[POSITIONS]   Open Positions: ${restorationResult.openPositions}`);
      console.log(`[POSITIONS]   Trades Processed: ${restorationResult.tradesProcessed}`);

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
