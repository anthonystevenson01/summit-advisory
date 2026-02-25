import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(req: NextRequest) {
  const roomId = req.nextUrl.searchParams.get('roomId')
  if (!roomId) return NextResponse.json([])
  const messages = await prisma.message.findMany({
    where: { roomId },
    orderBy: { createdAt: 'asc' },
  })
  return NextResponse.json(messages)
}

export async function POST(req: Request) {
  const { content, sender, roomId } = await req.json()
  const message = await prisma.message.create({
    data: { content, sender, roomId },
  })
  return NextResponse.json(message)
}
