import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🔍 Checking for corrupted metrics...\n');

  const metricsRecord = await prisma.metrics.findFirst({
    where: { name: 'Deepseek-R1-0528' },
    orderBy: { createdAt: 'asc' },
  });

  if (!metricsRecord) {
    console.log('❌ No metrics record found');
    return;
  }

  const metrics = metricsRecord.metrics as any[];
  console.log(`📊 Total metrics: ${metrics.length}`);

  // Filter out corrupted metrics where:
  // - availableCash === 30000 (3x START_MONEY)
  // - totalCashValue is null
  const cleanMetrics = metrics.filter((m: any) => {
    const perf = m.accountInformationAndPerformance;
    if (!perf) return false;

    const isCorrupted =
      perf.availableCash === 30000 ||
      perf.totalCashValue === null ||
      perf.totalCashValue === undefined;

    return !isCorrupted;
  });

  const corruptedCount = metrics.length - cleanMetrics.length;
  console.log(`🗑️  Found ${corruptedCount} corrupted metrics`);
  console.log(`✅ Clean metrics: ${cleanMetrics.length}\n`);

  if (corruptedCount === 0) {
    console.log('✨ No corrupted metrics found!');
    return;
  }

  // Show sample of corrupted timestamps
  const corrupted = metrics.filter((m: any) => {
    const perf = m.accountInformationAndPerformance;
    return (
      perf?.availableCash === 30000 ||
      perf?.totalCashValue === null ||
      perf?.totalCashValue === undefined
    );
  });

  console.log('📅 Corrupted metrics timeframe:');
  console.log(`   First: ${corrupted[0]?.createdAt}`);
  console.log(`   Last:  ${corrupted[corrupted.length - 1]?.createdAt}\n`);

  console.log('💾 Updating database...');
  await prisma.metrics.update({
    where: { id: metricsRecord.id },
    data: { metrics: cleanMetrics as any },
  });

  console.log(`✅ Successfully removed ${corruptedCount} corrupted metrics!`);
  console.log(`📊 New total: ${cleanMetrics.length} metrics`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
