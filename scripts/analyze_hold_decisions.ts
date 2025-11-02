import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const chats = await prisma.chat.findMany({
    take: 20,
    orderBy: { createdAt: "desc" },
    include: { tradings: true },
  });

  console.log("=".repeat(80));
  console.log("ANALYSIS OF HOLD DECISIONS - WHY ISN'T THE AI SELLING?");
  console.log("=".repeat(80));

  chats.slice(0, 5).forEach((chat, recordNum) => {
    const holdTradings = chat.tradings.filter(t => t.operation === "Hold");
    
    if (holdTradings.length > 0) {
      console.log("\n" + "=".repeat(80));
      console.log("RECORD #" + (recordNum + 1));
      console.log("Time: " + chat.createdAt);
      console.log("-".repeat(80));
      console.log("AI REASONING:\n" + chat.chat);
      console.log("-".repeat(80));
      
      holdTradings.forEach((t, i) => {
        console.log("Operation " + (i + 1) + ": HOLD");
        console.log("Symbol: " + t.symbol);
        console.log("Success: " + t.success);
      });
    }
  });

  // Also check what positions AI is aware of
  console.log("\n\n" + "=".repeat(80));
  console.log("CHECKING USER PROMPTS FOR POSITION AWARENESS");
  console.log("=".repeat(80));

  const latestChat = chats[0];
  if (latestChat && latestChat.userPrompt) {
    const prompt = latestChat.userPrompt;
    const positionsMatch = prompt.match(/Positions:[\s\S]*?(?=\n##|$)/);
    if (positionsMatch) {
      console.log("\nLatest User Prompt - Position Section:");
      console.log(positionsMatch[0].substring(0, 1000));
    }
  }

  await prisma.$disconnect();
}

main().catch(console.error);
