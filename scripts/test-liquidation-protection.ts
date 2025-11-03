/**
 * Test Script: Liquidation Protection
 *
 * This script tests the liquidation price calculation and protection logic
 * without making real trades.
 *
 * Usage: bun run scripts/test-liquidation-protection.ts
 */

import { dryRunWallet } from "@/lib/trading/dry-run-wallet";

console.log("🧪 Testing Liquidation Protection\n");

// Test Case 1: BTC Long Position with 10x Leverage
console.log("=== TEST CASE 1: BTC Long 10x Leverage ===");
const btcLongPosition = {
  symbol: "BTC/USDT",
  side: "long" as const,
  size: 10000, // $10,000 position size
  entryPrice: 100000, // Entered at $100,000
  leverage: 10,
  timestamp: Date.now(),
};

const btcLiqPrice = dryRunWallet.calculateLiquidationPrice(btcLongPosition);
console.log(`Entry Price: $${btcLongPosition.entryPrice.toLocaleString()}`);
console.log(`Position Size: $${btcLongPosition.size.toLocaleString()} (${btcLongPosition.leverage}x leverage)`);
console.log(`Margin: $${(btcLongPosition.size / btcLongPosition.leverage).toLocaleString()}`);
console.log(`Liquidation Price: $${btcLiqPrice.toLocaleString()}`);
console.log(`Price Drop to Liquidation: ${(((btcLongPosition.entryPrice - btcLiqPrice) / btcLongPosition.entryPrice) * 100).toFixed(2)}%\n`);

// Test liquidation distance at various price levels
const testPrices = [100000, 99000, 98000, 97000, 96000, 95000, 94000];
console.log("Price Movement Simulation:");
testPrices.forEach((price) => {
  const distance = dryRunWallet.calculateLiquidationDistance(btcLongPosition, price);
  const pnl = dryRunWallet.calculateUnrealizedPnL(btcLongPosition, price);
  const pnlPercent = (pnl / (btcLongPosition.size / btcLongPosition.leverage)) * 100;
  const warningSymbol = distance <= 10 ? "🚨" : distance <= 20 ? "⚠️" : "✅";

  console.log(
    `  ${warningSymbol} Price: $${price.toLocaleString().padEnd(8)} | ` +
    `Distance: ${distance.toFixed(2)}%`.padEnd(18) + ` | ` +
    `PnL: $${pnl.toFixed(2)}`.padEnd(15) + ` (${pnlPercent.toFixed(2)}%)`
  );
});

// Test Case 2: ETH Long Position with 20x Leverage (Higher Risk)
console.log("\n=== TEST CASE 2: ETH Long 20x Leverage (High Risk) ===");
const ethLongPosition = {
  symbol: "ETH/USDT",
  side: "long" as const,
  size: 5000, // $5,000 position size
  entryPrice: 4000, // Entered at $4,000
  leverage: 20,
  timestamp: Date.now(),
};

const ethLiqPrice = dryRunWallet.calculateLiquidationPrice(ethLongPosition);
console.log(`Entry Price: $${ethLongPosition.entryPrice.toLocaleString()}`);
console.log(`Position Size: $${ethLongPosition.size.toLocaleString()} (${ethLongPosition.leverage}x leverage)`);
console.log(`Margin: $${(ethLongPosition.size / ethLongPosition.leverage).toLocaleString()}`);
console.log(`Liquidation Price: $${ethLiqPrice.toLocaleString()}`);
console.log(`Price Drop to Liquidation: ${(((ethLongPosition.entryPrice - ethLiqPrice) / ethLongPosition.entryPrice) * 100).toFixed(2)}%\n`);

// Test Case 3: SOL Short Position
console.log("=== TEST CASE 3: SOL Short 5x Leverage ===");
const solShortPosition = {
  symbol: "SOL/USDT",
  side: "short" as const,
  size: 2000, // $2,000 position size
  entryPrice: 200, // Entered at $200
  leverage: 5,
  timestamp: Date.now(),
};

const solLiqPrice = dryRunWallet.calculateLiquidationPrice(solShortPosition);
console.log(`Entry Price: $${solShortPosition.entryPrice.toLocaleString()}`);
console.log(`Position Size: $${solShortPosition.size.toLocaleString()} (${solShortPosition.leverage}x leverage)`);
console.log(`Margin: $${(solShortPosition.size / solShortPosition.leverage).toLocaleString()}`);
console.log(`Liquidation Price: $${solLiqPrice.toLocaleString()}`);
console.log(`Price Rise to Liquidation: ${(((solLiqPrice - solShortPosition.entryPrice) / solShortPosition.entryPrice) * 100).toFixed(2)}%\n`);

// Summary
console.log("=== SUMMARY ===");
console.log("✅ Liquidation protection will trigger when distance < 10%");
console.log("⚠️  Warning zone: distance between 10-20%");
console.log("🚨 Danger zone: distance < 10% (auto-close activated)");
console.log("\nKey Insights:");
console.log("- Higher leverage = closer liquidation price = higher risk");
console.log("- 10x leverage: ~9% price move to liquidation");
console.log("- 20x leverage: ~4.5% price move to liquidation");
console.log("- Always monitor liquidation_distance_percent in position data");
