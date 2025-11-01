const { dryRunWallet } = require('../lib/trading/dry-run-wallet.ts');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function restorePositions() {
  console.log('\n=== Restoring Positions from Database ===\n');

  // Get all BUY trades that haven't been closed
  const buyTrades = await prisma.trading.findMany({
    where: {
      operation: 'Buy'
    },
    orderBy: {
      createdAt: 'asc'
    }
  });

  console.log(`Found ${buyTrades.length} BUY trades in database`);

  // For each buy trade, simulate adding it to the dry-run wallet
  for (const trade of buyTrades) {
    console.log(`\nRestoring position:`);
    console.log(`  Symbol: ${trade.symbol}/USDT`);
    console.log(`  Size: ${trade.amount} USDT`);
    console.log(`  Entry Price: ${trade.pricing}`);
    console.log(`  Leverage: ${trade.leverage}x`);

    // Manually call the wallet's openPosition or buy simulation
    // Since we can't directly access the private methods, we need to call the buy function
    const { buy } = require('../lib/trading/buy.ts');

    try {
      await buy({
        symbol: `${trade.symbol}/USDT`,
        size: trade.amount,
        leverage: trade.leverage || 1,
        price: trade.pricing
      });
      console.log(`  ✓ Position restored successfully`);
    } catch (error) {
      // If position already exists, that's fine
      if (error.message && error.message.includes('already have a position')) {
        console.log(`  ✓ Position already exists in wallet`);
      } else {
        console.log(`  ✗ Error: ${error.message}`);
      }
    }
  }

  // Check current positions
  console.log('\n=== Current Positions in Wallet ===\n');
  const positions = dryRunWallet.getPositions();
  console.log(`Total positions: ${positions.length}`);

  positions.forEach((pos, i) => {
    console.log(`\nPosition ${i + 1}:`);
    console.log(`  Symbol: ${pos.symbol}`);
    console.log(`  Side: ${pos.side}`);
    console.log(`  Size: ${pos.size} USDT`);
    console.log(`  Entry Price: ${pos.entryPrice}`);
    console.log(`  Leverage: ${pos.leverage}x`);
  });
}

restorePositions()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
