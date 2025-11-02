import { prisma } from "../lib/prisma";
import { randomUUID } from "crypto";

async function backfillLegacyPosition() {
  console.log("🔄 Backfilling legacy position with positionId...\n");

  // Find the first BUY trade (legacy one without positionId)
  const legacyTrade = await prisma.trading.findFirst({
    where: {
      operation: "Buy",
      success: true,
      positionId: null,
    },
    orderBy: {
      createdAt: "asc", // Get the first one
    },
  });

  if (!legacyTrade) {
    console.log("❌ No legacy trade found without positionId");
    return;
  }

  console.log("📦 Found legacy trade:");
  console.log(`   Symbol: ${legacyTrade.symbol}`);
  console.log(`   Amount: ${legacyTrade.amount}`);
  console.log(`   Price: ${legacyTrade.pricing}`);
  console.log(`   Created: ${legacyTrade.createdAt.toISOString()}`);
  console.log(`   Position ID: ${legacyTrade.positionId || "null"}`);

  // Generate a new positionId
  const newPositionId = randomUUID();
  console.log(`\n🆔 Generating new positionId: ${newPositionId}`);

  // Update the trade with the new positionId
  await prisma.trading.update({
    where: {
      id: legacyTrade.id,
    },
    data: {
      positionId: newPositionId,
    },
  });

  console.log("\n✅ Successfully backfilled legacy position!");

  // Verify the update
  const updatedTrade = await prisma.trading.findUnique({
    where: {
      id: legacyTrade.id,
    },
  });

  console.log("\n📊 Updated trade:");
  console.log(`   Position ID: ${updatedTrade?.positionId}`);

  await prisma.$disconnect();
}

backfillLegacyPosition().catch(console.error);
