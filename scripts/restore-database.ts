/**
 * Restore Database Script
 *
 * This script restores a database from a JSON backup file.
 *
 * Usage: bun run scripts/restore-database.ts <backup-file>
 * Example: bun run scripts/restore-database.ts backup_2025-11-03T12-30-00.json
 */

import { prisma } from "@/lib/prisma";
import * as fs from "fs";
import * as path from "path";

async function restoreBackup(backupFile: string) {
  console.log("🔄 Restoring database from backup...\n");

  if (!fs.existsSync(backupFile)) {
    throw new Error(`Backup file not found: ${backupFile}`);
  }

  try {
    console.log(`📦 Restoring from: ${backupFile}`);

    // Read backup file
    const backupData = JSON.parse(fs.readFileSync(backupFile, "utf-8"));

    console.log("\n🗑️  Clearing existing data...");
    // Clear existing data first
    await prisma.trading.deleteMany();
    await prisma.chat.deleteMany();
    await prisma.metrics.deleteMany();

    console.log("\n📥 Restoring data...");

    // Restore metrics
    if (backupData.metrics?.length > 0) {
      await prisma.metrics.createMany({
        data: backupData.metrics,
      });
      console.log(`   ✅ Restored ${backupData.metrics.length} metrics records`);
    }

    // Restore chats and their tradings
    if (backupData.chats?.length > 0) {
      for (const chat of backupData.chats) {
        const { tradings, ...chatData } = chat;
        await prisma.chat.create({
          data: {
            ...chatData,
            tradings: tradings?.length > 0 ? {
              create: tradings.map((t: any) => {
                const { chatId, ...tradingData } = t;
                return tradingData;
              }),
            } : undefined,
          },
        });
      }
      console.log(`   ✅ Restored ${backupData.chats.length} chat entries`);
    }

    // Count restored trades
    const tradeCount = await prisma.trading.count();
    console.log(`   ✅ Restored ${tradeCount} trades`);

    console.log("\n✅ Database restored successfully!\n");
  } catch (error) {
    console.error("❌ Failed to restore backup:", error);
    throw error;
  }
}

async function main() {
  const backupFile = process.argv[2];

  if (!backupFile) {
    console.error("❌ Error: Please provide a backup file path");
    console.log("\nUsage: bun run scripts/restore-database.ts <backup-file>");
    console.log("Example: bun run scripts/restore-database.ts backup_2025-11-03T12-30-00.json\n");
    process.exit(1);
  }

  try {
    await restoreBackup(backupFile);
  } catch (error) {
    console.error("\n❌ Restore failed:", error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
