const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
  console.log('\n=== Checking Database ===\n');

  // Check all trades
  const trades = await prisma.trading.findMany({
    include: {
      Chat: true
    },
    orderBy: {
      createdAt: 'desc'
    }
  });

  console.log(`Found ${trades.length} trades:\n`);

  trades.forEach((trade, i) => {
    console.log(`Trade ${i + 1}:`);
    console.log(`  Operation: ${trade.operation}`);
    console.log(`  Symbol: ${trade.symbol}`);
    console.log(`  Amount: ${trade.amount}`);
    console.log(`  Price: ${trade.pricing}`);
    console.log(`  Leverage: ${trade.leverage}`);
    console.log(`  Created: ${trade.createdAt}`);
    console.log('');
  });

  // Check all chat entries
  const chats = await prisma.chat.count();
  console.log(`Total Chat entries: ${chats}`);

  // Check metrics
  const metrics = await prisma.metrics.findFirst();
  if (metrics) {
    console.log(`Metrics count: ${metrics.metrics.length}`);
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
