/**
 * Reset Database Script
 *
 * This script:
 * 1. Creates a timestamped JSON backup of the current database
 * 2. Clears all data from tables (keeps schema intact)
 * 3. Allows you to start fresh from the beginning
 *
 * Usage: bun run scripts/reset-database.ts
 */

import { prisma } from "@/lib/prisma";
import * as fs from "fs";
import * as path from "path";

async function createBackup(): Promise<string> {
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const backupFile = path.join(process.cwd(), `backup_${timestamp}.json`);

  console.log("📦 Creating database backup...");

  try {
    // Fetch all data from all tables
    const [metrics, chats, tradings] = await Promise.all([
      prisma.metrics.findMany(),
      prisma.chat.findMany({ include: { tradings: true } }),
      prisma.trading.findMany(),
    ]);

    const backup = {
      timestamp: new Date().toISOString(),
      metrics,
      chats,
      tradings,
    };

    // Write to JSON file
    fs.writeFileSync(backupFile, JSON.stringify(backup, null, 2));
    console.log(`✅ Backup created: ${backupFile}`);
    console.log(`   - ${metrics.length} metrics records`);
    console.log(`   - ${chats.length} chat entries`);
    console.log(`   - ${tradings.length} trades`);
    return backupFile;
  } catch (error) {
    console.error("❌ Failed to create backup:", error);
    throw error;
  }
}

async function clearAllData() {
  console.log("\n🗑️  Clearing all database data...");

  try {
    // Delete in correct order (respecting foreign key constraints)
    // Trading must be deleted before Chat (foreign key)
    const tradingCount = await prisma.trading.deleteMany();
    console.log(`  - Deleted ${tradingCount.count} trades`);

    const chatCount = await prisma.chat.deleteMany();
    console.log(`  - Deleted ${chatCount.count} chat entries`);

    const metricsCount = await prisma.metrics.deleteMany();
    console.log(`  - Deleted ${metricsCount.count} metrics records`);

    console.log("✅ Database cleared successfully!\n");
  } catch (error) {
    console.error("❌ Failed to clear database:", error);
    throw error;
  }
}

async function main() {
  console.log("🔄 Database Reset Tool\n");
  console.log("This will:");
  console.log("  1. Create a backup of your current database");
  console.log("  2. Delete all data (keeping the schema)");
  console.log("  3. Allow you to start fresh\n");

  try {
    // Step 1: Create backup
    const backupFile = await createBackup();

    // Step 2: Clear all data
    await clearAllData();

    console.log("✨ Database reset complete!");
    console.log(`\n📁 Your backup is saved at: ${backupFile}`);
    console.log("\n💡 To restore from backup, run:");
    console.log(`   bun run db:restore ${path.basename(backupFile)}\n`);

  } catch (error) {
    console.error("\n❌ Reset failed:", error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
