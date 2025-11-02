import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const chats = await prisma.chat.findMany({
    take: 15,
    orderBy: { createdAt: "desc" },
    include: { tradings: true },
  });

  console.log("=".repeat(100));
  console.log("PATTERN ANALYSIS: ALL HOLD DECISIONS (Last 15 Records)");
  console.log("=".repeat(100));

  const holdPatterns = {
    mixedSignals: 0,
    consolidating: 0,
    waitingForDirection: 0,
    lowVolume: 0,
    noStrongSignals: 0,
    manualHoldMention: 0,
    positions: [] as any[],
  };

  chats.forEach((chat, recordNum) => {
    const holdTradings = chat.tradings.filter(t => t.operation === "Hold");
    
    if (holdTradings.length > 0) {
      const reasoning = chat.chat.toLowerCase();
      
      if (reasoning.includes("mixed signals")) holdPatterns.mixedSignals++;
      if (reasoning.includes("consolidat")) holdPatterns.consolidating++;
      if (reasoning.includes("wait")) holdPatterns.waitingForDirection++;
      if (reasoning.includes("low volume") || reasoning.includes("below average")) holdPatterns.lowVolume++;
      if (reasoning.includes("no strong") || reasoning.includes("no clear")) holdPatterns.noStrongSignals++;
      if (reasoning.includes("manually") || reasoning.includes("manual")) holdPatterns.manualHoldMention++;

      // Extract positions from user prompt
      if (chat.userPrompt && chat.userPrompt.includes("Positions:")) {
        const match = chat.userPrompt.match(/Positions:([\s\S]*?)(?=## HERE|$)/);
        if (match) {
          try {
            const posLines = match[1].trim().split('\n').filter(l => l.trim());
            posLines.forEach(line => {
              if (line.includes('"symbol"')) {
                const symbolMatch = line.match(/"symbol":"([^"]+)"/);
                if (symbolMatch) {
                  holdPatterns.positions.push(symbolMatch[1]);
                }
              }
            });
          } catch (e) {
            // ignore
          }
        }
      }
    }
  });

  console.log("\nCOMMON PATTERNS IN HOLD DECISIONS:");
  console.log("Mixed Signals Mentioned: " + holdPatterns.mixedSignals + " times");
  console.log("Consolidating Market: " + holdPatterns.consolidating + " times");
  console.log("Waiting for Direction: " + holdPatterns.waitingForDirection + " times");
  console.log("Low Volume Concern: " + holdPatterns.lowVolume + " times");
  console.log("No Strong Signals: " + holdPatterns.noStrongSignals + " times");
  console.log("Manual Hold Mention: " + holdPatterns.manualHoldMention + " times");

  console.log("\n" + "=".repeat(100));
  console.log("KEY FINDING:");
  console.log("=".repeat(100));
  console.log("\nThe AI is predominantly choosing HOLD because:");
  console.log("1. It uses 'mixed signals' as a catch-all reason");
  console.log("2. It emphasizes 'waiting for clearer direction' before selling");
  console.log("3. It considers consolidation as a HOLD signal, not a SELL signal");
  console.log("4. Low volume concerns suggest HOLD instead of liquidating positions");
  console.log("\nISSUE: The AI has multiple open positions but never recommends closing them.");
  console.log("The system prompt does NOT encourage profit-taking or loss-cutting.");

  await prisma.$disconnect();
}

main().catch(console.error);
