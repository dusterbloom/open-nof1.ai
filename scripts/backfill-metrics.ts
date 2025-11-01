/**
 * Backfill historical metrics data from trading history
 * This script reconstructs account value snapshots from trade records
 */

import { prisma } from "../lib/prisma";
import { dryRunWallet } from "../lib/trading/dry-run-wallet";
import { getCurrentMarketState } from "../lib/trading/current-market-state";

async function backfillMetrics() {
  console.log("🔄 Starting metrics backfill...");

  // Get all trades ordered by time
  const allTrades = await prisma.trading.findMany({
    orderBy: { createdAt: "asc" },
  });

  if (allTrades.length === 0) {
    console.log("❌ No trades found to backfill");
    return;
  }

  console.log(`📊 Found ${allTrades.length} trades to process`);

  // Get the first trade time
  const firstTradeTime = allTrades[0].createdAt;
  const now = new Date();

  console.log(`⏰ First trade: ${firstTradeTime.toISOString()}`);
  console.log(`⏰ Current time: ${now.toISOString()}`);

  // Delete existing metrics to avoid duplicates
  await prisma.metrics.deleteMany({
    where: {
      model: "Deepseek",
    },
  });

  console.log("🗑️  Cleared existing metrics");

  // Reset wallet
  dryRunWallet.reset();

  // Get current BTC price for calculating unrealized PnL
  let btcPrice = 110241; // Default to entry price
  try {
    const marketState = await getCurrentMarketState("BTC/USDT");
    btcPrice = marketState.current_price;
    console.log(`💰 Current BTC price: $${btcPrice.toLocaleString()}`);
  } catch (error) {
    console.warn("⚠️  Could not fetch current BTC price, using default");
  }

  const initialCapital = Number(process.env.START_MONEY) || 10000;

  // Generate metrics snapshots every 20 seconds from first trade to now
  const metricsArray = [];
  const intervalMs = 20 * 1000; // 20 seconds

  let currentTime = new Date(firstTradeTime.getTime());
  let currentTradeIndex = 0;

  while (currentTime <= now) {
    // Apply any trades that occurred up to this point
    while (
      currentTradeIndex < allTrades.length &&
      allTrades[currentTradeIndex].createdAt <= currentTime
    ) {
      const trade = allTrades[currentTradeIndex];

      if (trade.operation === "Buy" && trade.amount && trade.pricing) {
        dryRunWallet.openPosition({
          symbol: trade.symbol === "BTC" ? "BTC/USDT" : `${trade.symbol}/USDT`,
          side: "long",
          size: trade.amount,
          price: trade.pricing,
          leverage: trade.leverage || 1,
        });
        console.log(
          `📈 Applied BUY: ${trade.symbol} @ $${trade.pricing} for ${trade.amount} USDT at ${trade.createdAt.toISOString()}`
        );
      } else if (trade.operation === "Sell") {
        dryRunWallet.closePosition({
          symbol: trade.symbol === "BTC" ? "BTC/USDT" : `${trade.symbol}/USDT`,
          price: trade.pricing || btcPrice,
        });
        console.log(
          `📉 Applied SELL: ${trade.symbol} @ $${trade.pricing || btcPrice} at ${trade.createdAt.toISOString()}`
        );
      }

      currentTradeIndex++;
    }

    // Get current positions for this snapshot
    const positions = dryRunWallet.getPositions().map((pos) => ({
      symbol: pos.symbol,
      side: pos.side,
      size: pos.size,
      entryPrice: pos.entryPrice,
      leverage: pos.leverage,
      unrealizedPnl: dryRunWallet.calculateUnrealizedPnL(pos, btcPrice),
    }));

    // Calculate account metrics at this point in time
    const accountValue = dryRunWallet.getTotalAccountValue({
      "BTC/USDT": btcPrice,
    });
    const totalReturn = (accountValue - initialCapital) / initialCapital;
    const balance = dryRunWallet.getBalance();

    // Calculate locked margin
    let lockedMargin = 0;
    for (const pos of dryRunWallet.getPositions()) {
      lockedMargin += pos.size / pos.leverage;
    }

    // Create snapshot with full accountInformationAndPerformance structure
    metricsArray.push({
      accountInformationAndPerformance: {
        positions: positions,
        sharpeRatio: null,
        availableCash: balance,
        contractValue: lockedMargin,
        totalCashValue: accountValue,
        currentTotalReturn: totalReturn,
        currentPositionsValue: lockedMargin,
      },
      createdAt: currentTime.toISOString(),
    });

    // Move to next interval
    currentTime = new Date(currentTime.getTime() + intervalMs);
  }

  console.log(`📦 Creating single Metrics record with ${metricsArray.length} snapshots...`);

  // Create ONE Metrics record with all snapshots
  await prisma.metrics.create({
    data: {
      model: "Deepseek",
      name: "Deepseek-R1-0528",
      metrics: metricsArray as any,
    },
  });

  console.log("✨ Metrics backfill complete!");
  console.log(`📊 Total snapshots created: ${metricsArray.length}`);
  const lastSnapshot = metricsArray[metricsArray.length - 1];
  console.log(`💰 Final account value: $${lastSnapshot.accountInformationAndPerformance.totalCashValue.toLocaleString()}`);
  console.log(`📈 Total return: ${(lastSnapshot.accountInformationAndPerformance.currentTotalReturn * 100).toFixed(2)}%`);
}

backfillMetrics()
  .then(() => {
    console.log("🎉 Done!");
    process.exit(0);
  })
  .catch((error) => {
    console.error("❌ Error:", error);
    process.exit(1);
  });
