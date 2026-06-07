import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// POST - 检查外部编码是否已存在
export async function POST(request: NextRequest) {
  try {
    const { codes } = await request.json()

    if (!codes || !Array.isArray(codes) || codes.length === 0) {
      return NextResponse.json({ success: true, data: { duplicates: [] } })
    }

    // 查询数据库中已存在的外部编码
    const existing = await prisma.order.findMany({
      where: {
        externalCode: { in: codes.filter(Boolean) },
      },
      select: { externalCode: true },
      distinct: ['externalCode'],
    })

    const duplicates = existing.map(e => e.externalCode).filter(Boolean)

    return NextResponse.json({ success: true, data: { duplicates } })
  } catch (error) {
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 })
  }
}
