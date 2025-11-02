import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🔍 Checking for corrupted Chat records...\n');

  // Find Chat records with $30,000 corruption (3x START_MONEY)
  const corruptedChats = await prisma.chat.findMany({
    where: {
      createdAt: {
        gte: new Date('2025-11-02T16:07:00Z'),
        lte: new Date('2025-11-02T16:20:00Z'),
      },
    },
    include: {
      tradings: true,
    },
    orderBy: {
      createdAt: 'asc',
    },
  });

  console.log(`📊 Found ${corruptedChats.length} Chat records in corrupted timeframe`);

  const corruptedWithCash30k = corruptedChats.filter(
    (chat) => chat.userPrompt.includes('Available Cash: 30000')
  );

  console.log(`🗑️  ${corruptedWithCash30k.length} have $30k corruption\n`);

  if (corruptedWithCash30k.length === 0) {
    console.log('✨ No corrupted Chat records found!');
    return;
  }

  // Show details
  console.log('📅 Corrupted Chat records:');
  corruptedWithCash30k.forEach((chat, i) => {
    const isReset = chat.userPrompt.includes('invoked 0 times');
    console.log(
      `   ${i + 1}. ${chat.createdAt.toISOString()} (${chat.tradings.length} trades${isReset ? ', RESET' : ''})`
    );
  });
  console.log();

  // Delete corrupted Chat records (Trading records cascade delete)
  const chatIds = corruptedWithCash30k.map((c) => c.id);
  const tradingCount = corruptedWithCash30k.reduce((sum, c) => sum + c.tradings.length, 0);

  console.log(`💾 Deleting ${corruptedWithCash30k.length} Chat records...`);
  console.log(`   (This will cascade delete ${tradingCount} Trading records)`);

  const result = await prisma.chat.deleteMany({
    where: {
      id: {
        in: chatIds,
      },
    },
  });

  console.log(`\n✅ Successfully deleted ${result.count} corrupted Chat records!`);

  // Verify final counts
  const finalChatCount = await prisma.chat.count();
  const finalTradingCount = await prisma.trading.count();

  console.log(`\n📊 Final counts:`);
  console.log(`   Chat: ${finalChatCount} records`);
  console.log(`   Trading: ${finalTradingCount} records`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
