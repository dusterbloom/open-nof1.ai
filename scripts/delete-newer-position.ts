import { prisma } from "../lib/prisma";

async function deleteNewerPosition() {
  console.log("🗑️  Deleting newer BTC position...\n");

  // Find the newer BTC position (the one at 110386.08)
  const newerPosition = await prisma.trading.findFirst({
    where: {
      operation: "Buy",
      symbol: "BTC",
      pricing: 110386.08,
      positionId: "8a6a90ab-3386-4016-9e84-98fe2ccdc52e",
    },
  });

  if (!newerPosition) {
    console.log("❌ Newer position not found");
    return;
  }

  console.log("📦 Found newer position to delete:");
  console.log(`   ID: ${newerPosition.id}`);
  console.log(`   Symbol: ${newerPosition.symbol}`);
  console.log(`   Amount: ${newerPosition.amount}`);
  console.log(`   Price: ${newerPosition.pricing}`);
  console.log(`   Created: ${newerPosition.createdAt.toISOString()}`);
  console.log(`   Position ID: ${newerPosition.positionId}`);

  // Also check for any related trades (like HOLD operations) with the same Chat
  if (newerPosition.chatId) {
    const relatedTrades = await prisma.trading.findMany({
      where: {
        chatId: newerPosition.chatId,
      },
    });
    console.log(`\n🔗 Found ${relatedTrades.length} trades linked to this chat`);
  }

  // Delete the position
  await prisma.trading.delete({
    where: {
      id: newerPosition.id,
    },
  });

  console.log("\n✅ Successfully deleted newer position!");

  // Show remaining positions
  const remainingBuyTrades = await prisma.trading.findMany({
    where: {
      operation: "Buy",
      symbol: "BTC",
      success: true,
    },
    orderBy: {
      createdAt: "asc",
    },
  });

  console.log(`\n📊 Remaining BTC BUY trades: ${remainingBuyTrades.length}`);
  for (const trade of remainingBuyTrades) {
    console.log(`   - ${trade.symbol} @ ${trade.pricing} (${trade.createdAt.toISOString()})`);
  }

  await prisma.$disconnect();
}

deleteNewerPosition().catch(console.error);
