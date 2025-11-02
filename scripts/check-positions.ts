import { prisma } from "../lib/prisma";

async function checkPositions() {
  console.log("🔍 Checking database positions...\n");

  // Get total count
  const totalTrades = await prisma.trading.count();
  console.log(`📊 Total trades in database: ${totalTrades}`);

  // Get recent trades
  const recentTrades = await prisma.trading.findMany({
    orderBy: { createdAt: "desc" },
    take: 10,
    select: {
      id: true,
      symbol: true,
      operation: true,
      amount: true,
      pricing: true,
      positionId: true,
      success: true,
      errorMessage: true,
      createdAt: true,
    },
  });

  console.log("\n📝 Recent 10 trades:");
  recentTrades.forEach((trade, i) => {
    console.log(`\n${i + 1}. ${trade.operation} ${trade.symbol}`);
    console.log(`   Amount: ${trade.amount}, Price: ${trade.pricing}`);
    console.log(`   Position ID: ${trade.positionId || "N/A"}`);
    console.log(`   Success: ${trade.success}, Error: ${trade.errorMessage || "N/A"}`);
    console.log(`   Time: ${trade.createdAt.toISOString()}`);
  });

  // Check for open positions (BUY without matching SELL)
  const buyTrades = await prisma.trading.findMany({
    where: {
      operation: "Buy",
      success: true,
    },
    orderBy: { createdAt: "desc" },
  });

  console.log(`\n\n💰 Total successful BUY trades: ${buyTrades.length}`);

  let openPositions = 0;
  for (const buy of buyTrades) {
    let sell;

    if (buy.positionId) {
      // New method: Match by positionId
      sell = await prisma.trading.findFirst({
        where: {
          operation: "Sell",
          positionId: buy.positionId,
          success: true,
        },
      });
    } else {
      // Legacy method: Match by symbol and time
      sell = await prisma.trading.findFirst({
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

    if (!sell) {
      openPositions++;
      console.log(`\n🟢 OPEN POSITION: ${buy.symbol}`);
      console.log(`   Position ID: ${buy.positionId || "N/A (legacy)"}`);
      console.log(`   Amount: ${buy.amount}, Price: ${buy.pricing}`);
      console.log(`   Opened: ${buy.createdAt.toISOString()}`);
    }
  }

  console.log(`\n\n📈 Total open positions: ${openPositions}`);

  await prisma.$disconnect();
}

checkPositions().catch(console.error);
