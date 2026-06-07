import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// GET - 获取所有规则
export async function GET() {
  try {
    const rules = await prisma.rule.findMany({
      orderBy: { createdAt: 'desc' },
    })
    return NextResponse.json({ success: true, data: rules })
  } catch (error) {
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 })
  }
}

// POST - 创建规则
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { name, description, fileType, ruleConfig, aiGenerated } = body

    if (!name || !ruleConfig) {
      return NextResponse.json({ success: false, error: '规则名称和配置不能为空' }, { status: 400 })
    }

    const rule = await prisma.rule.create({
      data: {
        name,
        description: description || '',
        fileType: fileType || 'excel',
        ruleConfig,
        aiGenerated: aiGenerated || false,
      },
    })

    return NextResponse.json({ success: true, data: rule })
  } catch (error) {
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 })
  }
}
