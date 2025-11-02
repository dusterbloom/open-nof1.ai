/**
 * Restore dry-run wallet state from database
 *
 * This function replays all successful trades from the database to restore
 * the wallet's balance, totalPnL, and open positions after a server restart.
 */

import { prisma } from "@/lib/prisma";
import { dryRunWallet } from "./dry-run-wallet";

export async function restoreDryRunWallet(): Promise<{
  success: boolean;
  balance: number;
  totalPnL: number;
  openPositions: number;
  tradesProcessed: number;
}> {
  console.log("[WALLET-RESTORE] Starting wallet restoration from database...");

  const startMoney = Number(process.env.START_MONEY) || 10000;

  // Get all successful trades ordered by time
  const allTrades = await prisma.trading.findMany({
    where: {
      success: true,
    },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      operation: true,
      symbol: true,
      pricing: true,
      amount: true,
      leverage: true,
      positionId: true,
      createdAt: true,
    },
  });

  console.log(`[WALLET-RESTORE] Found ${allTrades.length} successful trades`);
  console.log(`[WALLET-RESTORE] Buys: ${allTrades.filter(t => t.operation === "Buy").length}`);
  console.log(`[WALLET-RESTORE] Sells: ${allTrades.filter(t => t.operation === "Sell").length}`);

  // Reset wallet to initial state
  dryRunWallet.reset();

  // Track positions manually (simpler than wallet's internal state)
  const positions = new Map<string, {
    symbol: string;
    size: number;
    entryPrice: number;
    leverage: number;
    positionId: string;
  }>();

  let tradesProcessed = 0;

  // Replay all trades
  for (const trade of allTrades) {
    if (trade.operation === "Buy") {
      // Open position
      if (trade.amount && trade.pricing && trade.leverage && trade.positionId) {
        const result = dryRunWallet.openPosition({
          symbol: trade.symbol,
          side: "long",
          size: trade.amount,
          price: trade.pricing,
          leverage: trade.leverage,
        });

        if (result.success) {
          positions.set(trade.positionId, {
            symbol: trade.symbol,
            size: trade.amount,
            entryPrice: trade.pricing,
            leverage: trade.leverage,
            positionId: trade.positionId,
          });
          tradesProcessed++;
        } else {
          console.warn(`[WALLET-RESTORE] Failed to restore BUY: ${result.error}`);
        }
      }
    } else if (trade.operation === "Sell") {
      // Close position
      if (trade.positionId && positions.has(trade.positionId)) {
        const position = positions.get(trade.positionId)!;

        if (trade.pricing) {
          const result = dryRunWallet.closePosition({
            symbol: position.symbol,
            price: trade.pricing,
          });

          if (result.success) {
            positions.delete(trade.positionId);
            tradesProcessed++;
            console.log(`[WALLET-RESTORE] Closed ${position.symbol}: P&L ${result.pnl?.toFixed(2)} USDT`);
          } else {
            console.warn(`[WALLET-RESTORE] Failed to restore SELL: ${result.error}`);
          }
        }
      }
    }
  }

  const finalState = dryRunWallet.getState();

  console.log(`[WALLET-RESTORE] ✅ Restoration complete`);
  console.log(`[WALLET-RESTORE] Balance: ${finalState.balance.toFixed(2)} USDT`);
  console.log(`[WALLET-RESTORE] Total P&L: ${finalState.totalPnL.toFixed(2)} USDT`);
  console.log(`[WALLET-RESTORE] Open Positions: ${finalState.positions.length}`);
  console.log(`[WALLET-RESTORE] Trades Processed: ${tradesProcessed}`);

  return {
    success: true,
    balance: finalState.balance,
    totalPnL: finalState.totalPnL,
    openPositions: finalState.positions.length,
    tradesProcessed,
  };
}
