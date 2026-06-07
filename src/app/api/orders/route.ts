import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// GET - 获取订单列表（分页+筛选）
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const pageSize = parseInt(searchParams.get('pageSize') || '20')
    const externalCode = searchParams.get('externalCode') || ''
    const recipientName = searchParams.get('recipientName') || ''
    const startDate = searchParams.get('startDate') || ''
    const endDate = searchParams.get('endDate') || ''

    const where: Record<string, unknown> = {}
    if (externalCode) {
      where.externalCode = { contains: externalCode }
    }
    if (recipientName) {
      where.recipientName = { contains: recipientName }
    }
    if (startDate || endDate) {
      where.createdAt = {}
      if (startDate) (where.createdAt as Record<string, unknown>).gte = new Date(startDate)
      if (endDate) (where.createdAt as Record<string, unknown>).lte = new Date(endDate + 'T23:59:59')
    }

    const [total, orders] = await Promise.all([
      prisma.order.count({ where }),
      prisma.order.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ])

    return NextResponse.json({
      success: true,
      data: {
        orders,
        pagination: {
          page,
          pageSize,
          total,
          totalPages: Math.ceil(total / pageSize),
        },
      },
    })
  } catch (error) {
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 })
  }
}

// POST - 批量创建订单
export async function POST(request: NextRequest) {
  try {
    const { orders } = await request.json()

    if (!orders || !Array.isArray(orders) || orders.length === 0) {
      return NextResponse.json({ success: false, error: '订单数据不能为空' }, { status: 400 })
    }

    const batchId = `batch_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`

    // 批量插入，每批100条
    const batchSize = 100
    let successCount = 0
    let failCount = 0

    for (let i = 0; i < orders.length; i += batchSize) {
      const batch = orders.slice(i, i + batchSize).map((order: Record<string, unknown>) => ({
        externalCode: String(order.externalCode || ''),
        storeName: String(order.storeName || ''),
        recipientName: String(order.recipientName || ''),
        recipientPhone: String(order.recipientPhone || ''),
        recipientAddress: String(order.recipientAddress || ''),
        skuCode: String(order.skuCode || ''),
        skuName: String(order.skuName || ''),
        skuQuantity: Number(order.skuQuantity) || 0,
        skuSpec: String(order.skuSpec || ''),
        remark: String(order.remark || ''),
        batchId,
      }))

      try {
        const result = await prisma.order.createMany({ data: batch })
        successCount += result.count
      } catch {
        failCount += batch.length
      }
    }

    return NextResponse.json({
      success: true,
      data: { successCount, failCount, batchId },
    })
  } catch (error) {
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 })
  }
}
