import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const chats = await prisma.chat.findMany({
    take: 30,
    orderBy: { createdAt: "desc" },
    include: { tradings: true },
  });

  let buyCount = 0;
  let sellCount = 0;
  let holdCount = 0;
  const sellExamples = [];

  console.log("=".repeat(70));
  console.log("ANALYSIS OF LAST 30 AI DECISIONS");
  console.log("=".repeat(70));

  chats.forEach((chat, i) => {
    const tradings = chat.tradings || [];
    
    tradings.forEach(t => {
      if (t.operation === "Buy") buyCount++;
      if (t.operation === "Sell") {
        sellCount++;
        sellExamples.push({
          index: i + 1,
          time: chat.createdAt,
          chat: chat.chat,
          symbol: t.symbol,
          success: t.success
        });
      }
      if (t.operation === "Hold") holdCount++;
    });
  });

  console.log("\nOPERATION DISTRIBUTION:");
  console.log("Buy:  " + buyCount);
  console.log("Sell: " + sellCount);
  console.log("Hold: " + holdCount);

  const total = buyCount + sellCount + holdCount;
  if (total > 0) {
    console.log("\nPERCENTAGES:");
    console.log("Buy:  " + ((buyCount / total) * 100).toFixed(1) + "%");
    console.log("Sell: " + ((sellCount / total) * 100).toFixed(1) + "%");
    console.log("Hold: " + ((holdCount / total) * 100).toFixed(1) + "%");
  }

  console.log("\n" + "=".repeat(70));
  console.log("SELL DECISIONS FOUND: " + sellExamples.length);
  console.log("=".repeat(70));

  sellExamples.forEach((example, i) => {
    console.log("\nSELL #" + (i + 1) + " (Record " + example.index + ")");
    console.log("Time: " + example.time);
    console.log("Symbol: " + example.symbol);
    console.log("Success: " + example.success);
    console.log("Reasoning: " + example.chat.substring(0, 400) + "...");
  });

  if (sellExamples.length === 0) {
    console.log("\nWARNING: NO SELL OPERATIONS FOUND IN LAST 30 RECORDS!");
  }

  await prisma.$disconnect();
}

main().catch(console.error);
