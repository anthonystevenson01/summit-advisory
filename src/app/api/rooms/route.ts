import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  const rooms = await prisma.room.findMany({ orderBy: { createdAt: 'desc' } })
  return NextResponse.json(rooms)
}

export async function POST(req: Request) {
  const { name } = await req.json()
  const room = await prisma.room.create({ data: { name } })
  return NextResponse.json(room)
}
