import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

const totalCount = await prisma.trading.count()
console.log('')
console.log('=== TRADING TABLE SUMMARY ===')
console.log('Total Trading records:', totalCount)

const last10 = await prisma.trading.findMany({
  take: 10,
  orderBy: { createdAt: 'desc' }
})

console.log('')
console.log('=== LAST 10 TRADES ===')
last10.forEach((trade, position) => {
  const time = new Date(trade.createdAt).toLocaleString()
  console.log(position + 1 + '. [' + time + '] ' + trade.operation + ' ' + trade.symbol + ' at $' + trade.pricing)
})

await prisma.$disconnect()
