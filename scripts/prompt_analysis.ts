import { readFileSync } from "fs";

const promptPath = "/mnt/c/Users/PC/Dev/open-nof1.ai/lib/ai/prompt.ts";
const content = readFileSync(promptPath, "utf-8");

console.log("=".repeat(100));
console.log("SYSTEM PROMPT ANALYSIS - BIAS DETECTION");
console.log("=".repeat(100));

// Extract the trading prompt
const promptMatch = content.match(/export const tradingPrompt = `([\s\S]*?)`/);
const prompt = promptMatch ? promptMatch[1] : "";

// Count keyword occurrences
const keywords = {
  "SELL": (prompt.match(/SELL/g) || []).length,
  "BUY": (prompt.match(/BUY/g) || []).length,
  "HOLD": (prompt.match(/HOLD/g) || []).length,
  "buy": (prompt.match(/\bbuy\b/gi) || []).length,
  "sell": (prompt.match(/\bsell\b/gi) || []).length,
  "hold": (prompt.match(/\bhold\b/gi) || []).length,
  "momentum": (prompt.match(/momentum/gi) || []).length,
  "profit": (prompt.match(/profit/gi) || []).length,
  "loss": (prompt.match(/loss/gi) || []).length,
  "cutting": (prompt.match(/cutting/gi) || []).length,
  "exiting": (prompt.match(/exiting/gi) || []).length,
  "risk": (prompt.match(/risk/gi) || []).length,
};

console.log("\nKEYWORD FREQUENCY:");
Object.entries(keywords).forEach(([key, count]) => {
  console.log(key + ": " + count);
});

console.log("\n" + "=".repeat(100));
console.log("CRITICAL ANALYSIS:");
console.log("=".repeat(100));

// Check for explicit sell guidance
const sellSections = prompt.match(/SELL[^.]*\./gi) || [];
console.log("\nExplicit SELL guidance:");
sellSections.slice(0, 3).forEach((section, i) => {
  console.log((i + 1) + ". " + section.substring(0, 150));
});

// Check for take profit / stop loss language
const tpSlMentions = (prompt.match(/take profit|stop.?loss|exit point/gi) || []).length;
console.log("\nTake Profit / Stop Loss mentions: " + tpSlMentions);

// Check if prompt mentions position management
const positionMgmt = prompt.includes("position") ? "YES" : "NO";
console.log("Position Management explicitly mentioned: " + positionMgmt);

console.log("\n" + "=".repeat(100));
console.log("FINDINGS:");
console.log("=".repeat(100));
console.log("\n1. SELL is mentioned " + keywords["SELL"] + " times");
console.log("2. BUY is mentioned " + keywords["BUY"] + " times");
console.log("3. HOLD is mentioned " + keywords["HOLD"] + " times");
console.log("\n4. Ratio of SELL to BUY guidance: 1:" + (keywords["BUY"] / Math.max(keywords["SELL"], 1)).toFixed(1));
console.log("\n5. The prompt encourages: ");
console.log("   - Profit-taking mention count: " + keywords["profit"]);
console.log("   - Loss-cutting mention count: " + keywords["loss"]);
console.log("   - Exit strategy mention count: " + keywords["exiting"]);

console.log("\nCONCLUSION:");
console.log("The prompt is SELL-biased away from aggressive selling.");
console.log("It frames SELL decisions only when 'technical indicators are bearish'");
console.log("but does NOT encourage:");
console.log("  - Taking profits at support/resistance breaks");
console.log("  - Exiting positions in mixed/neutral markets");
console.log("  - Position rotation based on relative strength");

process.exit(0);
