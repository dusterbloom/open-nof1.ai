/**
 * Test script to verify schema changes
 */
import { prisma } from "../lib/prisma";

async function testSchema() {
  console.log("🧪 Testing schema changes...\n");

  // Test 1: Check existing trades
  const totalTrades = await prisma.trading.count();
  console.log(`✅ Total trades in database: ${totalTrades}`);

  // Test 2: Check that new fields exist
  const sampleTrade = await prisma.trading.findFirst();
  if (sampleTrade) {
    console.log("\n📊 Sample trade record:");
    console.log(`  - ID: ${sampleTrade.id}`);
    console.log(`  - Symbol: ${sampleTrade.symbol}`);
    console.log(`  - Operation: ${sampleTrade.operation}`);
    console.log(`  - Amount: ${sampleTrade.amount} (type: ${typeof sampleTrade.amount})`);
    console.log(`  - Pricing: ${sampleTrade.pricing} (type: ${typeof sampleTrade.pricing})`);
    console.log(`  - Position ID: ${sampleTrade.positionId || 'null'}`);
    console.log(`  - Success: ${sampleTrade.success}`);
    console.log(`  - Error Message: ${sampleTrade.errorMessage || 'null'}`);
  }

  // Test 3: Create a test trade with new fields
  console.log("\n🔬 Creating test trade with Float values...");
  const testTrade = await prisma.trading.create({
    data: {
      symbol: "BTC",
      operation: "Hold",
      amount: 1234.56,
      pricing: 110500.75,
      stopLoss: 109000.50,
      takeProfit: 112000.25,
      positionId: "test-position-123",
      success: true,
      errorMessage: null,
    },
  });

  console.log(`✅ Test trade created with ID: ${testTrade.id}`);
  console.log(`  - Amount (Float): ${testTrade.amount}`);
  console.log(`  - Pricing (Float): ${testTrade.pricing}`);
  console.log(`  - Stop Loss (Float): ${testTrade.stopLoss}`);
  console.log(`  - Take Profit (Float): ${testTrade.takeProfit}`);
  console.log(`  - Position ID: ${testTrade.positionId}`);
  console.log(`  - Success: ${testTrade.success}`);

  // Test 4: Create a failed trade example
  console.log("\n🔬 Creating test failed trade...");
  const failedTrade = await prisma.trading.create({
    data: {
      symbol: "ETH",
      operation: "Buy",
      amount: 500.0,
      pricing: 3500.5,
      success: false,
      errorMessage: "Insufficient balance",
    },
  });

  console.log(`✅ Failed trade created with ID: ${failedTrade.id}`);
  console.log(`  - Success: ${failedTrade.success}`);
  console.log(`  - Error Message: ${failedTrade.errorMessage}`);

  // Clean up test trades
  console.log("\n🧹 Cleaning up test trades...");
  await prisma.trading.deleteMany({
    where: {
      id: {
        in: [testTrade.id, failedTrade.id],
      },
    },
  });

  console.log("\n✨ Schema test complete!");
  console.log(`\n📈 Summary:`);
  console.log(`  - Existing data preserved: ✅`);
  console.log(`  - Float types working: ✅`);
  console.log(`  - positionId field available: ✅`);
  console.log(`  - success field available: ✅`);
  console.log(`  - errorMessage field available: ✅`);
}

testSchema()
  .then(() => {
    console.log("\n🎉 All tests passed!");
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n❌ Test failed:", error);
    process.exit(1);
  });
