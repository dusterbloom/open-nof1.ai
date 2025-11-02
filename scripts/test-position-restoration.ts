import { dryRunWallet } from "@/lib/trading/dry-run-wallet";

async function testRestoration() {
  console.log("🔄 Clearing dry-run wallet...");

  // Clear the wallet by resetting its state
  const currentPositions = dryRunWallet.getPositions();
  console.log(`Current positions before clear: ${currentPositions.length}`);

  // Show what's currently in the wallet
  for (const pos of currentPositions) {
    console.log(`  - ${pos.symbol} @ ${pos.entryPrice} (size: ${pos.size})`);
  }

  // Reset wallet to initial state (completely clear)
  dryRunWallet["state"] = {
    balance: parseInt(process.env.START_MONEY || "10000"),
    initialBalance: parseInt(process.env.START_MONEY || "10000"),
    positions: [],
    totalPnL: 0,
    trades: [],
  };

  console.log(`Wallet cleared. New balance: ${dryRunWallet.getBalance()}`);
  console.log(`New positions: ${dryRunWallet.getPositions().length}`);

  // Now trigger the /api/positions endpoint
  console.log("\n📞 Calling /api/positions to trigger restoration...");

  const response = await fetch("http://localhost:3001/api/positions");
  const data = await response.json();

  console.log("\n📊 Response:");
  console.log(JSON.stringify(data, null, 2));
}

testRestoration().catch(console.error);
