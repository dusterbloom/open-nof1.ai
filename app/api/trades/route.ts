import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const GET = async () => {
  try {
    console.log("[TRADES] GET request received");

    // Fetch all trading records with related Chat data
    const trades = await prisma.trading.findMany({
      orderBy: {
        createdAt: "asc", // Oldest first
      },
      include: {
        Chat: {
          select: {
            reasoning: true,
            chat: true,
          },
        },
      },
    });

    console.log(`[TRADES] Found ${trades.length} historical trades`);

    // Transform the data to match the expected response format
    const formattedTrades = trades.map((trade) => ({
      id: trade.id,
      symbol: trade.symbol,
      operation: trade.operation,
      amount: trade.amount,
      pricing: trade.pricing,
      leverage: trade.leverage,
      stopLoss: trade.stopLoss,
      takeProfit: trade.takeProfit,
      positionId: trade.positionId,
      success: trade.success,
      errorMessage: trade.errorMessage,
      createdAt: trade.createdAt.toISOString(),
      updatedAt: trade.updatedAt.toISOString(),
      chat: trade.Chat
        ? {
            reasoning: trade.Chat.reasoning,
            chat: trade.Chat.chat,
          }
        : undefined,
    }));

    return NextResponse.json({
      data: formattedTrades,
      success: true,
    });
  } catch (error) {
    console.error("[TRADES] Error fetching trades:", error);
    return NextResponse.json(
      {
        error: "Failed to fetch trades data",
        success: false,
      },
      { status: 500 }
    );
  }
};
