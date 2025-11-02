import { prisma } from "../lib/prisma";

async function debugLegacyPosition() {
  console.log("🔍 Debugging legacy position issue...\n");

  // Get ALL BUY trades with full details
  const buyTrades = await prisma.trading.findMany({
    where: {
      operation: "Buy",
      success: true,
    },
    orderBy: { createdAt: "asc" },
  });

  console.log(`📊 Total successful BUY trades: ${buyTrades.length}\n`);

  for (const buy of buyTrades) {
    console.log(`\n${"=".repeat(60)}`);
    console.log(`📅 Created: ${buy.createdAt.toISOString()}`);
    console.log(`🪙  Symbol: ${buy.symbol}`);
    console.log(`💰 Amount: ${buy.amount} (type: ${typeof buy.amount})`);
    console.log(`💵 Pricing: ${buy.pricing} (type: ${typeof buy.pricing})`);
    console.log(`📊 Leverage: ${buy.leverage}`);
    console.log(`🆔 Position ID: ${buy.positionId || "null"}`);
    console.log(`✅ Success: ${buy.success}`);

    // Check for matching SELL trade
    let sellTrade;

    if (buy.positionId) {
      console.log(`\n🔍 Searching for SELL by positionId...`);
      sellTrade = await prisma.trading.findFirst({
        where: {
          operation: "Sell",
          positionId: buy.positionId,
          success: true,
        },
      });
    } else {
      console.log(`\n🔍 Searching for SELL by symbol and time (legacy)...`);
      sellTrade = await prisma.trading.findFirst({
        where: {
          operation: "Sell",
          symbol: buy.symbol,
          success: true,
          createdAt: {
            gt: buy.createdAt,
          },
        },
        orderBy: {
          createdAt: "asc",
        },
      });
    }

    if (sellTrade) {
      console.log(`❌ Position CLOSED at ${sellTrade.createdAt.toISOString()}`);
    } else {
      console.log(`✅ Position STILL OPEN - should be restored!`);

      // Check if restoration would work
      if (!buy.amount) {
        console.log(`⚠️  WARNING: amount is ${buy.amount} - restoration will SKIP!`);
      }
      if (!buy.pricing) {
        console.log(`⚠️  WARNING: pricing is ${buy.pricing} - restoration will SKIP!`);
      }
    }
  }

  await prisma.$disconnect();
}

debugLegacyPosition().catch(console.error);
