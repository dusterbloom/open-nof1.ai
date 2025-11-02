/**
 * Prisma Client Singleton
 *
 * Uses Next.js recommended global singleton pattern to prevent
 * multiple instances during development hot reloads.
 *
 * Connection pooling is configured via DATABASE_URL query parameters:
 * - connection_limit: Max connections per instance (recommended: 3-5 for VPS)
 * - pool_timeout: Connection pool timeout in seconds
 *
 * Example DATABASE_URL:
 * postgresql://user:password@host:5432/db?connection_limit=5&pool_timeout=10
 */

import { PrismaClient } from "@prisma/client";

const globalForPrisma = global as unknown as { prisma: PrismaClient };

export const prisma =
  globalForPrisma.prisma ||
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["query", "error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

// Graceful shutdown handler
if (typeof window === "undefined") {
  process.on("beforeExit", async () => {
    await prisma.$disconnect();
  });
}
