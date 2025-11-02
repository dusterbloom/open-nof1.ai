import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ModelType } from "@prisma/client";

export const GET = async (request: NextRequest) => {
  // Check if we should fetch trades view (successful Buy/Sell only)
  const { searchParams } = new URL(request.url);
  const view = searchParams.get("view");

  if (view === "trades") {
    // Fetch all successful Buy trades
    const buyTrades = await prisma.trading.findMany({
      where: {
        operation: "Buy",
        success: true,
      },
      orderBy: {
        createdAt: "desc",
      },
      include: {
        Chat: {
          select: {
            id: true,
            model: true,
            chat: true,
            reasoning: true,
          },
        },
      },
    });

    // For each buy, find matching sell and calculate PnL
    const tradesWithPnL = await Promise.all(
      buyTrades.map(async (buy) => {
        let sell = null;
        let pnl = null;
        let pnlPercentage = null;
        let status: "open" | "closed" = "open";

        if (buy.positionId) {
          sell = await prisma.trading.findFirst({
            where: {
              operation: "Sell",
              positionId: buy.positionId,
              success: true,
            },
            include: {
              Chat: {
                select: {
                  id: true,
                  model: true,
                },
              },
            },
          });

          if (sell && buy.pricing && sell.pricing && buy.amount && buy.leverage) {
            // Calculate PnL: (exit - entry) / entry * size * leverage
            const priceChange = sell.pricing - buy.pricing;
            const percentChange = (priceChange / buy.pricing) * 100;
            pnlPercentage = percentChange * buy.leverage;
            pnl = (buy.amount * percentChange * buy.leverage) / 100;
            status = "closed";
          }
        }

        return {
          buy,
          sell,
          pnl,
          pnlPercentage,
          status,
        };
      })
    );

    // Take only the 10 most recent
    const recentTrades = tradesWithPnL.slice(0, 10);

    return NextResponse.json({
      data: {
        trades: recentTrades,
      },
    });
  }

  // Default: fetch chats with all their tradings (for chat view)
  const chat = await prisma.chat.findMany({
    where: {
      model: ModelType.Deepseek,
    },
    take: 10,
    orderBy: {
      createdAt: "desc",
    },
    include: {
      tradings: {
        take: 10,
        orderBy: {
          createdAt: "desc",
        },
      },
    },
  });

  return NextResponse.json({
    data: {
      chat,
    },
  });
};
